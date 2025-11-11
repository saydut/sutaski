# blueprints/finans.py

import logging
from flask import Blueprint, jsonify, render_template, request
# 'session' import'u kaldırıldı, 'g' objesi kullanılacak
from decorators import login_required, role_required 
from services.finans_service import finans_service
from services.tedarikci_service import tedarikci_service

logger = logging.getLogger(__name__)
finans_bp = Blueprint('finans', __name__, url_prefix='/finans')

@finans_bp.route('/')
@login_required
@role_required('firma_admin') # Finans sayfasını sadece admin görebilir
def finans_sayfasi():
    """
    Finans yönetim sayfasını render eder.
    Manuel işlem ekleme formu için tedarikçi listesini de gönderir.
    """
    try:
        # RLS, sadece bu şirketin tedarikçilerini getirecek
        tedarikciler, error = tedarikci_service.get_all()
        if error:
            logger.error(f"Finans sayfası için tedarikçiler alınamadı: {error}")
            tedarikciler = []
            
        return render_template('finans_yonetimi.html', tedarikciler=tedarikciler)
    except Exception as e:
        logger.error(f"Finans sayfası yüklenirken hata: {str(e)}")
        return render_template('finans_yonetimi.html', tedarikciler=[])


@finans_bp.route('/api/islemler', methods=['GET'])
@login_required
@role_required('firma_admin') # Finans listesini sadece admin görebilir
def get_finansal_islemler():
    """Finansal işlemleri RLS ve RPC kullanarak sayfalı listeler."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        limit = int(request.args.get('limit', 15))
        tarih_str = request.args.get('tarih_str') # JS tarafındaki filtreyle eşleşmeli
        tip = request.args.get('tip')
        
        # sirket_id, kullanici_id, rol parametreleri KALDIRILDI
        # Servis bu bilgileri 'g' objesinden (decorator'dan) alacak
        islemler, toplam_sayi = finans_service.get_paginated_transactions(
            sayfa=sayfa, 
            limit=limit, 
            tarih_str=tarih_str, 
            tip=tip
        )
        
        return jsonify({"islemler": islemler, "toplam_kayit": toplam_sayi})
    except Exception as e:
        logger.error(f"Finansal işlemler API hatası: {e}", exc_info=True)
        return jsonify({"error": "Finansal işlemler listelenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler', methods=['POST'])
@login_required
@role_required('firma_admin') # Manuel işlemi sadece admin ekler
def add_finansal_islem():
    """
    Yeni (manuel) finansal işlem ekler.
    Servis, ID'leri 'g' objesinden alır.
    """
    try:
        # sirket_id ve kullanici_id parametreleri KALDIRILDI
        message, error = finans_service.add_transaction(request.get_json())
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": message}), 201
    except Exception as e:
        logger.error(f"Finansal işlem ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "İşlem eklenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin günceller
def update_finansal_islem(islem_id):
    """
    Manuel finansal işlemi RLS kullanarak günceller.
    (Otomatik oluşan yem/süt işlemleri buradan güncellenmemeli!)
    """
    try:
        # sirket_id parametresi KALDIRILDI
        success, error = finans_service.update_transaction(islem_id, request.get_json())
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": "İşlem başarıyla güncellendi."})
    except Exception as e:
        logger.error(f"Finansal işlem güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "İşlem güncellenirken bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin siler
def delete_finansal_islem(islem_id):
    """
    Manuel finansal işlemi RLS kullanarak siler.
    (Otomatik oluşan yem/süt işlemleri buradan silinmemeli!)
    """
    try:
        # sirket_id parametresi KALDIRILDI
        success, error = finans_service.delete_transaction(islem_id)
        
        if error:
            return jsonify({"error": error}), 404
            
        return jsonify({"message": "İşlem başarıyla silindi."})
    except Exception as e:
        logger.error(f"Finansal işlem silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "İşlem silinirken bir sunucu hatası oluştu."}), 500