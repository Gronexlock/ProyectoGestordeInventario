import prismaMock from "../__mocks__/prismaClient";
import * as movementService from "../../services/movement.service";
import { AppError } from "../../utils/AppError";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProduct = {
  id: "prod-1",
  name: "Producto Test",
  sku: "SKU-001",
  minStock: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Ubicación siempre abierta (00:00 - 23:59) */
const mockLocationOpen = {
  id: "loc-1",
  name: "Bodega A",
  type: "WAREHOUSE",
  capacity: null as number | null,
  dispatchStart: "00:00",
  dispatchEnd: "23:59",
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Ubicación siempre cerrada */
const mockLocationClosed = {
  ...mockLocationOpen,
  id: "loc-closed",
  dispatchStart: "00:00",
  dispatchEnd: "00:01",
};

const mockStock = {
  id: "stock-1",
  productId: "prod-1",
  locationId: "loc-1",
  quantity: 50,
  reserved: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMovement = {
  id: "mov-1",
  productId: "prod-1",
  locationId: "loc-1",
  destinationLocationId: null as string | null,
  type: "IN" as const,
  quantity: 20,
  note: null as string | null,
  createdAt: new Date(),
};

// ─── createMovement ───────────────────────────────────────────────────────────

describe("movementService.createMovement", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Default: mediodía (dentro del horario 00:00-23:59)
    jest.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("lanza AppError 404 si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    await expect(
      movementService.createMovement({
        productId: "no-existe",
        locationId: "loc-1",
        type: "IN",
        quantity: 5,
      })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si la ubicación no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(null);

    await expect(
      movementService.createMovement({
        productId: "prod-1",
        locationId: "no-existe",
        type: "IN",
        quantity: 5,
      })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la cantidad es 0 o negativa", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    await expect(
      movementService.createMovement({
        productId: "prod-1",
        locationId: "loc-1",
        type: "IN",
        quantity: 0,
      })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si un OUT está fuera del horario de despacho", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationClosed as any);

    await expect(
      movementService.createMovement({
        productId: "prod-1",
        locationId: "loc-closed",
        type: "OUT",
        quantity: 5,
      })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si un OUT deja stock negativo", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    // Transacción: stock actual = 3, se intenta sacar 10
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue({ ...mockStock, quantity: 3 }),
          upsert: jest.fn(),
        },
        movement: { create: jest.fn() },
        stockAlert: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      };
      return fn(txMock);
    });

    await expect(
      movementService.createMovement({
        productId: "prod-1",
        locationId: "loc-1",
        type: "OUT",
        quantity: 10,
      })
    ).rejects.toThrow(AppError);
  });

  it("registra un movimiento IN exitoso (stock existente), sin alerta cuando stock > minStock", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    const updatedStock = { ...mockStock, quantity: 70 };
    const createdMovement = { ...mockMovement, type: "IN" as const, quantity: 20 };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue({ ...mockStock, quantity: 50 }),
          upsert: jest.fn().mockResolvedValue(updatedStock),
        },
        movement: { create: jest.fn().mockResolvedValue(createdMovement) },
        stockAlert: {
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(txMock);
    });

    const result = await movementService.createMovement({
      productId: "prod-1",
      locationId: "loc-1",
      type: "IN",
      quantity: 20,
    });

    expect(result.movement).toEqual(createdMovement);
    expect(result.updatedStock).toEqual(updatedStock);
    // 70 > minStock(10) → sin alerta
    expect(result.alert).toBeUndefined();
  });

  it("registra un movimiento IN cuando no hay stock previo (upsert crea)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    const createdStock = { ...mockStock, quantity: 5 }; // 5 ≤ minStock=10 → alert msg
    const createdMovement = { ...mockMovement, type: "IN" as const, quantity: 5 };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue(null), // sin stock previo
          upsert: jest.fn().mockResolvedValue(createdStock),
        },
        movement: { create: jest.fn().mockResolvedValue(createdMovement) },
        stockAlert: {
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn(),
        },
      };
      return fn(txMock);
    });

    const result = await movementService.createMovement({
      productId: "prod-1",
      locationId: "loc-1",
      type: "IN",
      quantity: 5,
    });

    // 5 ≤ 10 → el check post-transacción activa el mensaje de alerta
    expect(result.alert).toContain("STOCK CRÍTICO");
  });

  it("registra un movimiento OUT exitoso y crea alerta cuando stock ≤ minStock (sin alerta previa)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    const updatedStock = { ...mockStock, quantity: 8 }; // 8 ≤ minStock(10)
    const createdMovement = { ...mockMovement, type: "OUT" as const, quantity: 42 };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue({ ...mockStock, quantity: 50 }),
          upsert: jest.fn().mockResolvedValue(updatedStock),
        },
        movement: { create: jest.fn().mockResolvedValue(createdMovement) },
        stockAlert: {
          findFirst: jest.fn().mockResolvedValue(null), // sin alerta previa
          create: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn(),
        },
      };
      return fn(txMock);
    });

    const result = await movementService.createMovement({
      productId: "prod-1",
      locationId: "loc-1",
      type: "OUT",
      quantity: 42,
    });

    expect(result.alert).toContain("STOCK CRÍTICO");
  });

  it("OUT: no duplica alerta cuando ya existe una PENDING", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    const alertCreate = jest.fn();
    const updatedStock = { ...mockStock, quantity: 5 };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue({ ...mockStock, quantity: 50 }),
          upsert: jest.fn().mockResolvedValue(updatedStock),
        },
        movement: { create: jest.fn().mockResolvedValue(mockMovement) },
        stockAlert: {
          findFirst: jest.fn().mockResolvedValue({ id: "alert-existing" }), // ya existe
          create: alertCreate,
          updateMany: jest.fn(),
        },
      };
      return fn(txMock);
    });

    await movementService.createMovement({
      productId: "prod-1",
      locationId: "loc-1",
      type: "OUT",
      quantity: 45,
    });

    expect(alertCreate).not.toHaveBeenCalled();
  });

  it("IN que supera minStock resuelve alertas PENDING existentes", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationOpen as any);

    const alertUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const updatedStock = { ...mockStock, quantity: 20 }; // 20 > minStock(10)

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue({ ...mockStock, quantity: 5 }),
          upsert: jest.fn().mockResolvedValue(updatedStock),
        },
        movement: { create: jest.fn().mockResolvedValue(mockMovement) },
        stockAlert: {
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: alertUpdateMany,
        },
      };
      return fn(txMock);
    });

    await movementService.createMovement({
      productId: "prod-1",
      locationId: "loc-1",
      type: "IN",
      quantity: 15,
    });

    expect(alertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED" }),
      })
    );
  });

  it("no valida horario de despacho para movimientos IN", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    // Ubicación cerrada, pero es IN → no debería importar
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocationClosed as any);

    const updatedStock = { ...mockStock, quantity: 60 };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn().mockResolvedValue(mockStock),
          upsert: jest.fn().mockResolvedValue(updatedStock),
        },
        movement: { create: jest.fn().mockResolvedValue(mockMovement) },
        stockAlert: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      return fn(txMock);
    });

    await expect(
      movementService.createMovement({
        productId: "prod-1",
        locationId: "loc-closed",
        type: "IN",
        quantity: 10,
      })
    ).resolves.toBeDefined();
  });
});

// ─── createTransfer ───────────────────────────────────────────────────────────

describe("movementService.createTransfer", () => {
  const mockDestLocation = {
    ...mockLocationOpen,
    id: "loc-2",
    name: "Bodega B",
    capacity: null as number | null,
  };

  const baseDto = {
    productId: "prod-1",
    sourceLocationId: "loc-1",
    destinationLocationId: "loc-2",
    quantity: 10,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setupBasicMocks = () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationOpen as any)
      .mockResolvedValueOnce(mockDestLocation as any);
  };

  it("lanza AppError 404 si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationOpen as any)
      .mockResolvedValueOnce(mockDestLocation as any);

    await expect(movementService.createTransfer(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si la ubicación de origen no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockDestLocation as any);

    await expect(movementService.createTransfer(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si la ubicación de destino no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationOpen as any)
      .mockResolvedValueOnce(null);

    await expect(movementService.createTransfer(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si origen y destino son la misma ubicación", async () => {
    setupBasicMocks();

    await expect(
      movementService.createTransfer({
        ...baseDto,
        destinationLocationId: "loc-1", // igual al origen
      })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la cantidad es 0", async () => {
    setupBasicMocks();

    await expect(
      movementService.createTransfer({ ...baseDto, quantity: 0 })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la ubicación de origen está fuera de horario", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationClosed as any)
      .mockResolvedValueOnce(mockDestLocation as any);

    await expect(
      movementService.createTransfer({ ...baseDto, sourceLocationId: "loc-closed" })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el stock disponible en origen es insuficiente", async () => {
    setupBasicMocks();

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 5, reserved: 0 }) // origen con solo 5
            .mockResolvedValueOnce(null), // destino
          update: jest.fn(),
          upsert: jest.fn(),
          findMany: jest.fn(),
        },
        movement: { create: jest.fn() },
        stockAlert: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      };
      return fn(txMock);
    });

    await expect(
      movementService.createTransfer({ ...baseDto, quantity: 10 }) // quiere 10 pero solo hay 5
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el destino supera su capacidad", async () => {
    const destWithCapacity = { ...mockDestLocation, capacity: 20 };
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationOpen as any)
      .mockResolvedValueOnce(destWithCapacity as any);

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 50, reserved: 0 }) // origen suficiente
            .mockResolvedValueOnce(null), // destino sin stock previo
          update: jest.fn(),
          upsert: jest.fn(),
          findMany: jest.fn().mockResolvedValue([{ quantity: 18 }]), // ya ocupa 18 de capacidad 20
        },
        movement: { create: jest.fn() },
        stockAlert: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      };
      return fn(txMock);
    });

    await expect(
      movementService.createTransfer({ ...baseDto, quantity: 10 }) // 18 + 10 > 20
    ).rejects.toThrow(AppError);
  });

  it("realiza la transferencia exitosa sin capacidad en destino, crea alerta en origen y resuelve en destino", async () => {
    setupBasicMocks();

    const movOut = { ...mockMovement, type: "TRANSFER" as const };
    const movIn = { ...mockMovement, id: "mov-2", type: "TRANSFER" as const };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 15, reserved: 0 }) // origen: 15 disponibles
            .mockResolvedValueOnce({ ...mockStock, locationId: "loc-2", quantity: 5 }), // destino: ya tiene 5
          update: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
          findMany: jest.fn(),
        },
        movement: {
          create: jest.fn()
            .mockResolvedValueOnce(movOut)
            .mockResolvedValueOnce(movIn),
        },
        stockAlert: {
          findFirst: jest.fn().mockResolvedValue(null), // sin alerta previa en origen
          create: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(txMock);
    });

    // Tras transferir 10: origen queda en 5 (≤ minStock=10 → crea alerta)
    // Destino queda en 15 (> minStock=10 → resuelve alerta)
    const result = await movementService.createTransfer({ ...baseDto, quantity: 10 });
    expect(result.movOut).toEqual(movOut);
    expect(result.movIn).toEqual(movIn);
  });

  it("transfiere exitosamente con destino con capacidad suficiente, sin alertas ni resoluciones", async () => {
    const destWithCapacity = { ...mockDestLocation, capacity: 100 };
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique
      .mockResolvedValueOnce(mockLocationOpen as any)
      .mockResolvedValueOnce(destWithCapacity as any);

    const movOut = { ...mockMovement, type: "TRANSFER" as const };
    const movIn = { ...mockMovement, id: "mov-2", type: "TRANSFER" as const };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 50, reserved: 0 }) // origen: 50
            .mockResolvedValueOnce(null), // destino: sin stock aún
          update: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([{ quantity: 10 }]), // 10 ocupado, capacidad 100
        },
        movement: {
          create: jest.fn()
            .mockResolvedValueOnce(movOut)
            .mockResolvedValueOnce(movIn),
        },
        stockAlert: {
          findFirst: jest.fn(),
          create: jest.fn(),
          // origen queda en 40 > minStock → no crea alerta
          // destino queda en 10 ≤ minStock → no resuelve alerta
          updateMany: jest.fn(),
        },
      };
      return fn(txMock);
    });

    // Transfiere 10: origen 50→40 (>minStock=10), destino 0→10 (=minStock → no resuelve)
    const result = await movementService.createTransfer({ ...baseDto, quantity: 10 });
    expect(result).toHaveProperty("movOut");
    expect(result).toHaveProperty("movIn");
  });

  it("transfiere con nota personalizada", async () => {
    setupBasicMocks();

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 50, reserved: 5 })
            .mockResolvedValueOnce(null),
          update: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
          findMany: jest.fn(),
        },
        movement: {
          create: jest.fn()
            .mockResolvedValueOnce(mockMovement)
            .mockResolvedValueOnce({ ...mockMovement, id: "mov-2" }),
        },
        stockAlert: {
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(txMock);
    });

    const result = await movementService.createTransfer({
      ...baseDto,
      quantity: 10,
      note: "Rebalanceo de inventario",
    });

    expect(result).toHaveProperty("movOut");
  });

  it("lanza AppError 400 cuando el stock de origen es null (nunca se registró stock)", async () => {
    setupBasicMocks();

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce(null) // origen sin registro de stock → availableSource = 0
            .mockResolvedValueOnce(null),
          update: jest.fn(),
          upsert: jest.fn(),
          findMany: jest.fn(),
        },
        movement: { create: jest.fn() },
        stockAlert: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      };
      return fn(txMock);
    });

    await expect(
      movementService.createTransfer({ ...baseDto, quantity: 5 })
    ).rejects.toThrow(AppError);
  });

  it("origen con alerta previa no crea duplicado", async () => {
    setupBasicMocks();

    const alertCreate = jest.fn();

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({ ...mockStock, quantity: 15, reserved: 0 }) // origen: 15
            .mockResolvedValueOnce(null), // destino: sin stock
          update: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
          findMany: jest.fn(),
        },
        movement: {
          create: jest.fn()
            .mockResolvedValueOnce(mockMovement)
            .mockResolvedValueOnce({ ...mockMovement, id: "mov-2" }),
        },
        stockAlert: {
          findFirst: jest.fn().mockResolvedValue({ id: "alert-existente" }), // ya existe
          create: alertCreate,
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(txMock);
    });

    await movementService.createTransfer({ ...baseDto, quantity: 10 });
    expect(alertCreate).not.toHaveBeenCalled();
  });
});

// ─── getAllMovements ───────────────────────────────────────────────────────────

describe("movementService.getAllMovements", () => {
  it("retorna la lista de movimientos con sus relaciones", async () => {
    const movements = [
      {
        ...mockMovement,
        product: { id: "prod-1", name: "Test", sku: "SKU-001" },
        location: { id: "loc-1", name: "Bodega A", type: "WAREHOUSE" },
      },
    ];

    prismaMock.movement.findMany.mockResolvedValueOnce(movements as any);

    const result = await movementService.getAllMovements();
    expect(result).toEqual(movements);
    expect(prismaMock.movement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({ product: expect.any(Object) }),
      })
    );
  });

  it("retorna arreglo vacío cuando no hay movimientos", async () => {
    prismaMock.movement.findMany.mockResolvedValueOnce([]);
    const result = await movementService.getAllMovements();
    expect(result).toEqual([]);
  });
});
