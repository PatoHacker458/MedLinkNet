from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

import models, schemas, security
from database import get_db

router = APIRouter(tags=["Dashboard"])

@router.get("/dashboard")
def get_dashboard_stats(
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db)
):
    total_products = db.query(models.Product).count()
    
    # Lógica de bajo stock (Python side por simplicidad, idealmente SQL)
    products = db.query(models.Product).all()
    low_stock_count = 0
    for p in products:
        current_stock = sum(b.quantity for b in p.batches)
        if current_stock < p.min_stock:
            low_stock_count += 1
            
    # Lotes por vencer (30 días)
    thirty_days_future = datetime.now() + timedelta(days=30)
    expiring_batches = db.query(models.Batch).filter(
        models.Batch.expiration_date <= thirty_days_future,
        models.Batch.quantity > 0
    ).count()
    
    # Últimas 5 transacciones
    recent_tx = db.query(models.Transaction).order_by(
        models.Transaction.timestamp.desc()
    ).limit(5).all()
    
    recent_tx_data = [
        {
            "id": t.id,
            "transaction_type": t.transaction_type,
            "quantity": t.quantity,
            "timestamp": t.timestamp,
            "batch_id": t.batch_id,
            "product_id": t.product_id,
            "username": t.user.username if t.user else "Sistema"
        }
        for t in recent_tx
    ]
    
    return {
        "total_products": total_products,
        "low_stock": low_stock_count,
        "expiring_batches": expiring_batches,
        "recent_transactions": recent_tx_data
    }