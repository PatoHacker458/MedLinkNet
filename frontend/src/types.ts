// src/types.ts
export interface Batch {
    id: number;
    batch_number: string;
    expiration_date: string;
    quantity: number;
}
  
export interface Transaction {
    id: number;
    transaction_type: string;
    quantity: number;
    timestamp: string;
    batch_id: number;
    username: string;
    product_id: number;
}
  
export interface Product {
    id: number;
    name: string;
    sku: string;
    min_stock: number;
    batches: Batch[];
}
  
export interface DashboardStats {
    total_products: number;
    low_stock: number;
    expiring_batches: number;
    recent_transactions: Transaction[];
}