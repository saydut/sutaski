# blueprints/yem.py

import logging
from flask import Blueprint, jsonify, render_template, request
# 'session' import'u kaldırıldı, @login_required zaten 'g' objesini dolduracak
from decorators import login_required, role_required 
from services.yem_service import yem_service

logger = logging.getLogger(__name__)
yem_bp = Blueprint('yem', __name__, url_prefix='/yem')

@yem_bp.route('/yonetim')
@login_required
# Eski '@lisans_kontrolu' yerine rol kontrolü koyuyoruz
@role_required('firma_admin', 'toplayici') # Yem yönetimini admin ve toplayıcı görebilir
def yem_yonetimi_sayfasi():
    """Yem yönetim sayfasını render eder. Veriler API ile yüklenecek."""
    return render_template('yem_yonetimi.html')

@yem_bp.route('/api/urunler/liste', methods=['GET'])
@login_required
def get_yem_urunleri_listesi():
    """Dropdown için yem ürün listesini RLS kullanarak çeker."""
    try:
        # sirket_id parametresi KALDIRILDI
        urunler, error = yem_service.get_all_products_for_dropdown()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(urunler)
    except Exception as e:
        logger.error(f"Yem ürünleri listesi (dropdown) alınamadı: {e}", exc_info=True)
        return jsonify({"error": "Yem ürünleri listesi alınamadı."}), 500

@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
@role_required('firma_admin') # Ürün listesini (detaylı) sadece admin görebilir
def get_yem_urunleri():
    """Yem ürünlerini RLS kullanarak sayfalı olarak çeker."""
    try:
        sayfa = int(request.args.get('sayfa', 1))
        # sirket_id parametresi KALDIRILDI
        urunler, toplam_sayi = yem_service.get_paginated_products(sayfa)
        return jsonify({"urunler": urunler, "toplam_urun_sayisi": toplam_sayi})
    except Exception as e:
        logger.error(f"Yem ürünleri listelenirken hata: {e}", exc_info=True)
        return jsonify({"error": "Yem ürünleri listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler', methods=['POST'])
@login_required
@role_required('firma_admin') # Sadece admin ürün ekleyebilir
def add_yem_urunu():
    """Yeni yem ürünü ekler. sirket_id'yi serviste g objesinden alır."""
    try:
        # sirket_id parametresi KALDIRILDI
        eklenen_urun, error = yem_service.add_product(request.get_json())
        if error:
             return jsonify({"error": error}), 400
        return jsonify({"message": "Yeni yem ürünü başarıyla eklendi.", "urun": eklenen_urun}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem ürünü eklenirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem ürünü eklenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin ürün güncelleyebilir
def update_yem_urunu(id):
    """Yem ürününü RLS kullanarak günceller."""
    try:
        # sirket_id parametresi KALDIRILDI
        guncellenen_urun, error = yem_service.update_product(id, request.get_json())
        if error:
            return jsonify({"error": error}), 400
        return jsonify({"message": "Yem ürünü başarıyla güncellendi.", "urun": guncellenen_urun})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem ürünü güncellenirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem ürünü güncellenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler/<int:id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin ürün silebilir
def delete_yem_urunu(id):
    """Yem ürününü RLS kullanarak siler."""
    try:
        # sirket_id parametresi KALDIRILDI
        yem_service.delete_product(id)
        return jsonify({"message": "Yem ürünü başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409 # 409 Conflict (ilişkili veri var)
    except Exception as e:
        logger.error(f"Yem ürünü silinirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem ürünü silinirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler', methods=['POST'])
@login_required
@role_required('firma_admin', 'toplayici') # Admin veya toplayıcı yem çıkışı yapabilir
def add_yem_islemi():
    """Yeni yem çıkış işlemi (tedarikçiye satış) ekler."""
    try:
        # sirket_id ve kullanici_id parametreleri KALDIRILDI
        # Servis, g objesinden alacak
        yeni_islem = yem_service.add_transaction(request.get_json())
        return jsonify({"message": "Yem çıkışı başarıyla kaydedildi.", "islem": yeni_islem}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem çıkışı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem çıkışı yapılırken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/giris/ekle', methods=['POST'])
@login_required
@role_required('firma_admin') # Sadece admin stok girişi yapabilir
def add_yem_girisi_api():
    """Yeni bir yem GİRİŞ işlemi (Stok Alımı) yapar."""
    try:
        # sirket_id ve kullanici_id parametreleri KALDIRILDI
        data = request.get_json()
        yeni_giris = yem_service.add_yem_girisi(data)
        
        return jsonify({"message": "Yem stoğu girişi ve gider kaydı başarıyla oluşturuldu.", "giris": yeni_giris}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem girişi API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem girişi eklenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/liste', methods=['GET'])
@login_required
def get_yem_islemleri():
    """Yem çıkış işlemlerini RLS ve RPC kullanarak sayfalı listeler."""
    try:
        # sirket_id, kullanici_id, rol parametreleri KALDIRILDI
        # Servis, g objesinden alacak
        sayfa = int(request.args.get('sayfa', 1))
        
        islemler, toplam_sayi = yem_service.get_paginated_transactions(sayfa)
        
        return jsonify({"islemler": islemler, "toplam_islem_sayisi": toplam_sayi})
    except Exception as e:
        logger.error(f"Yem işlemleri listelenirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem işlemleri listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def delete_yem_islemi(id):
    """Yem çıkış işlemini RLS kullanarak siler (stok iade edilir)."""
    try:
        # sirket_id parametresi KALDIRILDI
        success = yem_service.delete_transaction(id)
        if not success:
            raise ValueError("İşlem silinemedi.")
        return jsonify({"message": "Yem çıkış işlemi başarıyla iptal edildi ve stok iade edildi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Yem işlemi silinirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem işlemi iptal edilirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/islemler/<int:id>', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def update_yem_islemi(id):
    """Yem çıkış işlemini RLS kullanarak günceller (stok ayarlanır)."""
    try:
        # sirket_id parametresi KALDIRILDI
        success = yem_service.update_transaction(id, request.get_json())
        if not success:
             raise ValueError("İşlem güncellenemedi.")
        return jsonify({"message": "Yem çıkışı başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Yem işlemi güncellenirken API hatası: {e}", exc_info=True)
        return jsonify({"error": "Yem işlemi güncellenirken bir sunucu hatası oluştu."}), 500