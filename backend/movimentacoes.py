def registrar(db, *, tipo, dispositivo, cliente_id, evento_id=None):
    if not cliente_id:
        return
    db.add(models.MovimentacaoMaquina(
        tipo=tipo,
        dispositivo_id=dispositivo.id,
        cliente_id=cliente_id,
        evento_id=evento_id,
        numero_serial=dispositivo.numero_serial,
        modelo=dispositivo.modelo,
        created_at=datetime.now(),
    ))