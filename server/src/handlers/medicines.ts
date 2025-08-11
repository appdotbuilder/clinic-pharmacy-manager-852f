import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type CreateMedicineInput, type UpdateMedicineInput, type Medicine } from '../schema';
import { eq, lte, or, ilike, sql, like } from 'drizzle-orm';

// Helper function to convert database row to Medicine type
const convertToMedicine = (row: any): Medicine => ({
  ...row,
  price_per_unit: parseFloat(row.price_per_unit), // Convert string to number
  expiry_date: row.expiry_date ? new Date(row.expiry_date) : null, // Convert string to Date
  created_at: new Date(row.created_at), // Ensure Date type
  updated_at: new Date(row.updated_at) // Ensure Date type
});

// Create a new medicine
export async function createMedicine(input: CreateMedicineInput): Promise<Medicine> {
  try {
    const result = await db.insert(medicinesTable)
      .values({
        name: input.name,
        category: input.category,
        stock_quantity: input.stock_quantity,
        price_per_unit: input.price_per_unit.toString(), // Convert number to string for numeric column
        supplier_info: input.supplier_info || null,
        batch_number: input.batch_number || null,
        expiry_date: input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null, // Convert Date to string
        storage_conditions: input.storage_conditions || null
      })
      .returning()
      .execute();

    return convertToMedicine(result[0]);
  } catch (error) {
    console.error('Medicine creation failed:', error);
    throw error;
  }
}

// Get all medicines
export async function getMedicines(): Promise<Medicine[]> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .execute();

    return results.map(convertToMedicine);
  } catch (error) {
    console.error('Failed to fetch medicines:', error);
    throw error;
  }
}

// Get medicine by ID
export async function getMedicineById(id: number): Promise<Medicine | null> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    return convertToMedicine(results[0]);
  } catch (error) {
    console.error('Failed to fetch medicine by ID:', error);
    throw error;
  }
}

// Update medicine information
export async function updateMedicine(input: UpdateMedicineInput): Promise<Medicine> {
  try {
    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.price_per_unit !== undefined) updateData.price_per_unit = input.price_per_unit.toString();
    if (input.supplier_info !== undefined) updateData.supplier_info = input.supplier_info;
    if (input.batch_number !== undefined) updateData.batch_number = input.batch_number;
    if (input.expiry_date !== undefined) updateData.expiry_date = input.expiry_date ? input.expiry_date.toISOString().split('T')[0] : null;
    if (input.storage_conditions !== undefined) updateData.storage_conditions = input.storage_conditions;

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(medicinesTable)
      .set(updateData)
      .where(eq(medicinesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Medicine with ID ${input.id} not found`);
    }

    return convertToMedicine(result[0]);
  } catch (error) {
    console.error('Medicine update failed:', error);
    throw error;
  }
}

// Get low stock medicines
export async function getLowStockMedicines(threshold: number = 10): Promise<Medicine[]> {
  try {
    const results = await db.select()
      .from(medicinesTable)
      .where(lte(medicinesTable.stock_quantity, threshold))
      .execute();

    return results.map(convertToMedicine);
  } catch (error) {
    console.error('Failed to fetch low stock medicines:', error);
    throw error;
  }
}

// Search medicines by name or category
export async function searchMedicines(query: string): Promise<Medicine[]> {
  try {
    // Get all medicines and filter in JavaScript for now
    // This is simpler and more reliable than complex SQL
    const allMedicines = await db.select()
      .from(medicinesTable)
      .execute();

    const queryLower = query.toLowerCase();
    const filteredResults = allMedicines.filter(medicine => 
      medicine.name.toLowerCase().includes(queryLower) ||
      medicine.category.toLowerCase().includes(queryLower)
    );

    return filteredResults.map(convertToMedicine);
  } catch (error) {
    console.error('Medicine search failed:', error);
    throw error;
  }
}

// Update medicine stock quantity
export async function updateMedicineStock(id: number, quantity: number): Promise<Medicine> {
  try {
    const result = await db.update(medicinesTable)
      .set({ 
        stock_quantity: quantity,
        updated_at: new Date()
      })
      .where(eq(medicinesTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Medicine with ID ${id} not found`);
    }

    return convertToMedicine(result[0]);
  } catch (error) {
    console.error('Medicine stock update failed:', error);
    throw error;
  }
}