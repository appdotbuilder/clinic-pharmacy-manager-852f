import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type CreateMedicineInput, type UpdateMedicineInput } from '../schema';
import {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  getLowStockMedicines,
  searchMedicines,
  updateMedicineStock
} from '../handlers/medicines';
import { eq } from 'drizzle-orm';

// Test inputs
const testMedicineInput: CreateMedicineInput = {
  name: 'Test Medicine',
  category: 'pain_relievers',
  stock_quantity: 100,
  price_per_unit: 25.50,
  supplier_info: 'Test Supplier',
  batch_number: 'BATCH001',
  expiry_date: new Date('2025-12-31'),
  storage_conditions: 'Store in cool, dry place'
};

const minimalMedicineInput: CreateMedicineInput = {
  name: 'Minimal Medicine',
  category: 'antibiotics',
  stock_quantity: 50,
  price_per_unit: 15.75
};

describe('Medicines Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createMedicine', () => {
    it('should create a medicine with all fields', async () => {
      const result = await createMedicine(testMedicineInput);

      expect(result.name).toEqual('Test Medicine');
      expect(result.category).toEqual('pain_relievers');
      expect(result.stock_quantity).toEqual(100);
      expect(result.price_per_unit).toEqual(25.50);
      expect(typeof result.price_per_unit).toBe('number');
      expect(result.supplier_info).toEqual('Test Supplier');
      expect(result.batch_number).toEqual('BATCH001');
      expect(result.expiry_date).toEqual(new Date('2025-12-31'));
      expect(result.storage_conditions).toEqual('Store in cool, dry place');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a medicine with minimal fields', async () => {
      const result = await createMedicine(minimalMedicineInput);

      expect(result.name).toEqual('Minimal Medicine');
      expect(result.category).toEqual('antibiotics');
      expect(result.stock_quantity).toEqual(50);
      expect(result.price_per_unit).toEqual(15.75);
      expect(typeof result.price_per_unit).toBe('number');
      expect(result.supplier_info).toBeNull();
      expect(result.batch_number).toBeNull();
      expect(result.expiry_date).toBeNull();
      expect(result.storage_conditions).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should save medicine to database', async () => {
      const result = await createMedicine(testMedicineInput);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, result.id))
        .execute();

      expect(medicines).toHaveLength(1);
      expect(medicines[0].name).toEqual('Test Medicine');
      expect(medicines[0].category).toEqual('pain_relievers');
      expect(medicines[0].stock_quantity).toEqual(100);
      expect(parseFloat(medicines[0].price_per_unit)).toEqual(25.50);
      expect(medicines[0].created_at).toBeInstanceOf(Date);
    });
  });

  describe('getMedicines', () => {
    it('should return empty array when no medicines exist', async () => {
      const result = await getMedicines();
      expect(result).toEqual([]);
    });

    it('should return all medicines', async () => {
      await createMedicine(testMedicineInput);
      await createMedicine(minimalMedicineInput);

      const result = await getMedicines();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Medicine');
      expect(result[0].price_per_unit).toEqual(25.50);
      expect(typeof result[0].price_per_unit).toBe('number');
      expect(result[1].name).toEqual('Minimal Medicine');
      expect(result[1].price_per_unit).toEqual(15.75);
      expect(typeof result[1].price_per_unit).toBe('number');
    });
  });

  describe('getMedicineById', () => {
    it('should return null for non-existent medicine', async () => {
      const result = await getMedicineById(999);
      expect(result).toBeNull();
    });

    it('should return medicine by ID', async () => {
      const created = await createMedicine(testMedicineInput);

      const result = await getMedicineById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Medicine');
      expect(result!.price_per_unit).toEqual(25.50);
      expect(typeof result!.price_per_unit).toBe('number');
      expect(result!.category).toEqual('pain_relievers');
    });
  });

  describe('updateMedicine', () => {
    it('should update all medicine fields', async () => {
      const created = await createMedicine(testMedicineInput);

      const updateInput: UpdateMedicineInput = {
        id: created.id,
        name: 'Updated Medicine',
        category: 'cardiovascular',
        stock_quantity: 200,
        price_per_unit: 35.75,
        supplier_info: 'Updated Supplier',
        batch_number: 'BATCH002',
        expiry_date: new Date('2026-06-30'),
        storage_conditions: 'Refrigerate'
      };

      const result = await updateMedicine(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Medicine');
      expect(result.category).toEqual('cardiovascular');
      expect(result.stock_quantity).toEqual(200);
      expect(result.price_per_unit).toEqual(35.75);
      expect(typeof result.price_per_unit).toBe('number');
      expect(result.supplier_info).toEqual('Updated Supplier');
      expect(result.batch_number).toEqual('BATCH002');
      expect(result.expiry_date).toEqual(new Date('2026-06-30'));
      expect(result.storage_conditions).toEqual('Refrigerate');
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update partial fields', async () => {
      const created = await createMedicine(testMedicineInput);

      const updateInput: UpdateMedicineInput = {
        id: created.id,
        name: 'Partially Updated',
        stock_quantity: 75
      };

      const result = await updateMedicine(updateInput);

      expect(result.name).toEqual('Partially Updated');
      expect(result.stock_quantity).toEqual(75);
      expect(result.category).toEqual('pain_relievers'); // Should remain unchanged
      expect(result.price_per_unit).toEqual(25.50); // Should remain unchanged
    });

    it('should throw error for non-existent medicine', async () => {
      const updateInput: UpdateMedicineInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateMedicine(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should save updates to database', async () => {
      const created = await createMedicine(testMedicineInput);

      const updateInput: UpdateMedicineInput = {
        id: created.id,
        name: 'Database Updated',
        stock_quantity: 150
      };

      await updateMedicine(updateInput);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, created.id))
        .execute();

      expect(medicines[0].name).toEqual('Database Updated');
      expect(medicines[0].stock_quantity).toEqual(150);
    });
  });

  describe('getLowStockMedicines', () => {
    it('should return empty array when no low stock medicines', async () => {
      await createMedicine(testMedicineInput); // stock: 100

      const result = await getLowStockMedicines(10);
      expect(result).toEqual([]);
    });

    it('should return medicines with stock at or below threshold', async () => {
      await createMedicine({ ...testMedicineInput, stock_quantity: 5 });
      await createMedicine({ ...minimalMedicineInput, stock_quantity: 10 });
      await createMedicine({ ...testMedicineInput, name: 'High Stock', stock_quantity: 50 });

      const result = await getLowStockMedicines(10);

      expect(result).toHaveLength(2);
      expect(result.some(m => m.stock_quantity === 5)).toBe(true);
      expect(result.some(m => m.stock_quantity === 10)).toBe(true);
      expect(result.every(m => m.stock_quantity <= 10)).toBe(true);
      expect(result[0].price_per_unit).toEqual(25.50);
      expect(typeof result[0].price_per_unit).toBe('number');
    });

    it('should use default threshold of 10', async () => {
      await createMedicine({ ...testMedicineInput, stock_quantity: 8 });
      await createMedicine({ ...minimalMedicineInput, stock_quantity: 15 });

      const result = await getLowStockMedicines();

      expect(result).toHaveLength(1);
      expect(result[0].stock_quantity).toEqual(8);
    });
  });

  describe('searchMedicines', () => {
    it('should return empty array for no matches', async () => {
      const result = await searchMedicines('nonexistent');
      expect(result).toEqual([]);
    });

    it('should search by medicine name (case insensitive)', async () => {
      await createMedicine({ ...testMedicineInput, name: 'Aspirin', category: 'pain_relievers' });

      const result = await searchMedicines('aspirin');

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Aspirin');
      expect(result[0].price_per_unit).toEqual(25.50);
      expect(typeof result[0].price_per_unit).toBe('number');
    });

    it('should search by partial medicine name', async () => {
      await createMedicine({ 
        name: 'Aspirin', 
        category: 'pain_relievers',
        stock_quantity: 100,
        price_per_unit: 10.50,
        batch_number: 'ASP001'
      });
      
      await createMedicine({ 
        name: 'Warfarin', 
        category: 'cardiovascular',
        stock_quantity: 75,
        price_per_unit: 15.25,
        batch_number: 'WAR001'
      });

      // Search for "rin" which should match both "Aspirin" and "Warfarin"
      const result = await searchMedicines('rin');

      expect(result).toHaveLength(2);
      const names = result.map(m => m.name);
      expect(names).toContain('Aspirin');
      expect(names).toContain('Warfarin');
    });

    it('should search by category', async () => {
      await createMedicine({ ...testMedicineInput, name: 'Aspirin', category: 'pain_relievers' });
      await createMedicine({ ...testMedicineInput, name: 'Ibuprofen', category: 'pain_relievers' });

      const result = await searchMedicines('pain');

      expect(result).toHaveLength(2); // Aspirin, Ibuprofen
      expect(result.every(m => m.category === 'pain_relievers')).toBe(true);
    });

    it('should search case insensitively', async () => {
      await createMedicine({ ...minimalMedicineInput, name: 'Vitamin C', category: 'vitamins' });

      const result = await searchMedicines('VITAMIN');

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Vitamin C');
    });
  });

  describe('updateMedicineStock', () => {
    it('should update stock quantity', async () => {
      const created = await createMedicine(testMedicineInput);

      const result = await updateMedicineStock(created.id, 75);

      expect(result.id).toEqual(created.id);
      expect(result.stock_quantity).toEqual(75);
      expect(result.name).toEqual('Test Medicine'); // Other fields unchanged
      expect(result.price_per_unit).toEqual(25.50);
      expect(typeof result.price_per_unit).toBe('number');
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should throw error for non-existent medicine', async () => {
      await expect(updateMedicineStock(999, 50)).rejects.toThrow(/not found/i);
    });

    it('should save stock update to database', async () => {
      const created = await createMedicine(testMedicineInput);

      await updateMedicineStock(created.id, 25);

      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, created.id))
        .execute();

      expect(medicines[0].stock_quantity).toEqual(25);
    });

    it('should handle zero stock quantity', async () => {
      const created = await createMedicine(testMedicineInput);

      const result = await updateMedicineStock(created.id, 0);

      expect(result.stock_quantity).toEqual(0);
    });
  });
});