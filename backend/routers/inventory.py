from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import models, schemas, security
from database import get_db

router = APIRouter(tags=["Inventory"])

# --- PRODUCTOS ---
@router.get("/products/", response_model=List[schemas.Product])
def get_products(
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    return db.query(models.Product).all()

@router.post("/products/", response_model=schemas.Product)
def create_product(
    product: schemas.ProductCreate,
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # El borrado en cascada (ON DELETE CASCADE) de la DB se encarga del resto
    db.delete(product)
    db.commit()
    return {"msg": "Producto y su historial eliminados"}

# --- LOTES ---
@router.post("/products/{product_id}/batches/", response_model=schemas.Batch)
def add_batch(
    product_id: int,
    batch: schemas.BatchCreate,
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    db_batch = models.Batch(**batch.dict(), product_id=product_id)
    db.add(db_batch)
    
    # Registrar transacción de entrada (IN)
    transaction = models.Transaction(
        product_id=product_id,
        batch_id=None, # Se asignará tras commit si fuera necesario, pero aquí es creación
        transaction_type="IN",
        quantity=batch.quantity,
        user_id=current_user.id
    )
    db.add(transaction)
    
    db.commit()
    db.refresh(db_batch)
    
    # Actualizar batch_id en la transacción ahora que el lote tiene ID
    transaction.batch_id = db_batch.id
    db.commit()
    
    return db_batch

@router.delete("/batches/{batch_id}")
def delete_batch(
    batch_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_active_user)
):
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    db.delete(batch)
    db.commit()
    return {"msg": "Lote eliminado"}

# --- OPERACIONES ---
@router.post("/products/{product_id}/dispense/")
def dispense_product(
    product_id: int,
    dispense: schemas.DispenseRequest,
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    # Estrategia FEFO: Buscar lotes ordenados por fecha de expiración
    batches = db.query(models.Batch).filter(
        models.Batch.product_id == product_id,
        models.Batch.quantity > 0
    ).order_by(models.Batch.expiration_date).all()
    
    qty_needed = dispense.quantity
    total_stock = sum(b.quantity for b in batches)
    
    if total_stock < qty_needed:
        raise HTTPException(status_code=400, detail="Stock insuficiente")
    
    for batch in batches:
        if qty_needed <= 0:
            break
            
        take = min(batch.quantity, qty_needed)
        batch.quantity -= take
        qty_needed -= take
        
        # Registrar transacción de salida (OUT) por cada lote afectado
        transaction = models.Transaction(
            product_id=product_id,
            batch_id=batch.id,
            transaction_type="OUT",
            quantity=take,
            user_id=current_user.id
        )
        db.add(transaction)
        
    db.commit()
    return {"msg": "Dispensación exitosa"}

@router.get("/transactions/{product_id}", response_model=List[schemas.TransactionOut])
def get_history(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_active_user)
):
    transactions = db.query(models.Transaction).filter(
        models.Transaction.product_id == product_id
    ).order_by(models.Transaction.timestamp.desc()).all()
    
    # Mapeo manual para incluir el username (el resto lo hace Pydantic)
    return [
        {
            "id": t.id,
            "transaction_type": t.transaction_type,
            "quantity": t.quantity,
            "timestamp": t.timestamp,
            "batch_id": t.batch_id,
            "product_id": t.product_id,
            "user_id": t.user_id,
            "username": t.user.username if t.user else "Desconocido"
        }
        for t in transactions
    ]

@router.post("/transactions/{transaction_id}/revert")
def revert_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_active_user)
):
    tx = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
    if tx.transaction_type != "OUT":
        raise HTTPException(status_code=400, detail="Solo se pueden revertir salidas (OUT)")
        
    batch = db.query(models.Batch).filter(models.Batch.id == tx.batch_id).first()
    if not batch:
        raise HTTPException(status_code=400, detail="El lote original ya no existe")
        
    # Revertir stock
    batch.quantity += tx.quantity
    
    # Eliminar la transacción del historial
    db.delete(tx)
    db.commit()
    
    return {"msg": "Transacción revertida"}