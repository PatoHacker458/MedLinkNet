from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

# --- AUTH & USERS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "staff"

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    class Config:
        from_attributes = True

# --- INVENTARIO (Igual que antes) ---
class BatchBase(BaseModel):
    batch_number: str
    expiration_date: date
    quantity: int

class BatchCreate(BatchBase):
    pass

class Batch(BatchBase):
    id: int
    product_id: int
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    sku: str
    min_stock: int = 10

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    batches: List[Batch] = []
    class Config:
        from_attributes = True

class DispenseRequest(BaseModel):
    quantity: int

# --- KARDEX ---
class TransactionOut(BaseModel):
    id: int
    transaction_type: str
    quantity: int
    timestamp: datetime
    user_id: int
    username: str # Para mostrar el nombre en el frontend
    class Config:
        from_attributes = True