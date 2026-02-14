from sqlalchemy import Column, Integer, String, Date, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="staff") # admin, nurse, pharmacist
    is_active = Column(Boolean, default=True)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    sku = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    min_stock = Column(Integer, default=10)
    requires_prescription = Column(Boolean, default=False)
    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")

class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    batch_number = Column(String)
    expiration_date = Column(Date)
    quantity = Column(Integer)
    product = relationship("Product", back_populates="batches")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id")) # <--- NUEVO: Quién lo hizo
    transaction_type = Column(String) # IN / OUT
    quantity = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    product = relationship("Product")
    batch = relationship("Batch")