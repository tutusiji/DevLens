"""仓库路由"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas

router = APIRouter()


@router.get("/repos", response_model=list[schemas.Repository])
def list_repos(db: Session = Depends(get_db)):
    return db.query(models.Repository).all()
