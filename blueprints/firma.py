# blueprints/firma.py

import logging
from flask import Blueprint, jsonify, render_template, request, g, flash
# 'session' import'u kaldırıldı
from decorators import login_required, role_required 
from constants import UserRole 
# Servis objelerini (instance) direkt import ediyoruz
from services.firma_service import firma_service
# tedarikci_service'e de ihtiyacımız olacak (atama verileri için)
from services.tedarikci_service import tedarikci_service 

logger = logging.getLogger(__name__)
firma_bp = Blueprint('firma', __name__, url_prefix='/firma')

@firma_bp.route('/yonetim')
@login_required
# Eski decorator'lar yerine 'firma_admin' rolünü kullanıyoruz
# 'UserRole.FIRMA_YETKILISI.value' yerine SQL'de tanımladığımız 'firma_admin' rolünü kullanalım.
@role_required('firma_admin') 
def firma_yonetim_sayfasi():
    """Firma yetkilisinin personeli ve atamaları yönettiği arayüz sayfasını render eder."""
    # Sayfa yüklenirken veri çekmiyoruz, JS halledecek.
    return render_template('firma_yonetimi.html')

# --- API ROTALARI: PERSONEL (KULLANICI) YÖNETİMİ ---

@firma_bp.route('/api/personel', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_personel_api():
    """Yönetim sayfası için personel listesini (profiller) RLS kullanarak getirir."""
    try:
        # sirket_id parametresi KALDIRILDI.
        personel_listesi, error = firma_service.get_personel_listesi()
        if error:
            return jsonify({"error": error}), 500
        
        return jsonify(personel_listesi)
    except Exception as e:
        logger.error(f"Firma personel verileri alınırken hata: {e}", exc_info=True)
        return jsonify({"error": f"Personel verileri alınamadı: {str(e)}"}), 500

@firma_bp.route('/api/personel/ekle', methods=['POST'])
@login_required
@role_required('firma_admin')
def add_personel_api(): 
    """
    Yeni bir personel (toplayıcı veya çiftçi) ekler.
    Bu işlem hem Auth'ta hem de profiller tablosunda kayıt oluşturur.
    JS tarafı 'rol' ('toplayici' or 'ciftci'), 'email', 'password', 'kullanici_adi' göndermelidir.
    """
    try:
        data = request.get_json()
        
        # Rolü JSON'dan al, varsayılan 'toplayici'
        rol_tipi = data.get('rol', UserRole.TOPLAYICI.value) 
        
        # sirket_id ve g.supabase parametreleri KALDIRILDI
        yeni_personel, error = firma_service.create_personel_user(data, rol_tipi)
        
        if error:
            return jsonify({"error": error}), 400
        
        return jsonify({"message": "Personel başarıyla eklendi.", "data": yeni_personel}), 201
        
    except Exception as e:
        logger.error(f"Personel ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": f"Personel eklenirken bir sunucu hatası oluştu: {str(e)}"}), 500


@firma_bp.route('/api/personel/sil/<string:kullanici_id_uuid>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def delete_personel_api(kullanici_id_uuid):
    """Bir personeli (Auth ve Profil) RLS kullanarak siler."""
    try:
        # sirket_id ve g.supabase parametreleri KALDIRILDI
        # ID artık integer değil, UUID (string)
        success, error = firma_service.delete_personel_user(kullanici_id_uuid)
        
        if error:
             return jsonify({"error": error}), 400
             
        return jsonify({"message": "Personel başarıyla silindi."})
    except Exception as e:
        logger.error(f"Personel silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Personel silinirken bir sunucu hatası oluştu."}), 500

# --- API ROTALARI: TOPLAYICI-TEDARİKÇİ ATAMALARI ---

@firma_bp.route('/api/atamalar/veriler', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_atama_verileri_api():
    """Atama modalı için toplayıcı ve tedarikçi listelerini RLS ile getirir."""
    try:
        # sirket_id parametresi KALDIRILDI
        toplayicilar, tedarikciler, error = firma_service.get_atama_icin_veriler()
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({
            "toplayicilar": toplayicilar,
            "tedarikciler": tedarikciler
        })
    except Exception as e:
        logger.error(f"Atama verileri API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama verileri alınamadı."}), 500

@firma_bp.route('/api/atamalar', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_atamalar_api():
    """Mevcut tüm toplayıcı-tedarikçi atamalarını RLS ile listeler."""
    try:
        # sirket_id parametresi ve filtresi KALDIRILDI
        atamalar, error = firma_service.get_toplayici_tedarikci_atamalari()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(atamalar)
    except Exception as e:
        logger.error(f"Atama listesi API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atamalar listelenemedi."}), 500

@firma_bp.route('/api/atamalar/ekle', methods=['POST'])
@login_required
@role_required('firma_admin')
def add_atama_api():
    """Yeni bir toplayıcı-tedarikçi ataması yapar."""
    try:
        data = request.get_json()
        toplayici_id = data.get('toplayici_id') # Bu bir UUID (string)
        tedarikci_id = data.get('tedarikci_id') # Bu bir int
        
        # sirket_id parametresi KALDIRILDI
        # RLS (WITH CHECK), bu iki ID'nin aynı şirkette olduğunu doğrulayacak
        yeni_atama, error = firma_service.add_toplayici_tedarikci_atama(toplayici_id, tedarikci_id)
        if error:
            return jsonify({"error": error}), 400
        
        return jsonify({"message": "Atama başarıyla yapıldı.", "atama": yeni_atama}), 201
    except Exception as e:
        logger.error(f"Atama ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama yapılırken bir hata oluştu."}), 500

@firma_bp.route('/api/atamalar/sil/<int:atama_id>', methods=['DELETE'])
@login_required
@role_required('firma_admin')
def delete_atama_api(atama_id):
    """Bir atamayı RLS kullanarak siler."""
    try:
        # sirket_id parametresi KALDIRILDI
        # RLS, bu atama_id'nin bizim şirketimize ait olduğunu doğrulayacak
        success, error = firma_service.delete_toplayici_tedarikci_atama(atama_id)
        if error:
            return jsonify({"error": error}), 404
            
        return jsonify({"message": "Atama başarıyla silindi."})
    except Exception as e:
        logger.error(f"Atama silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Atama silinirken bir hata oluştu."}), 500

# NOT: Eski '/api/kullanici_detay', '/api/kullanici_guncelle' ve 
# '/api/kullanici_sifre_setle' rotaları, yeni Auth ve RLS yapımızda
# yerini daha güvenli olan 'personel' ve 'atama' rotalarına bırakmıştır.
# 'firma_yonetimi.js' dosyanızın bu yeni API rotalarına göre güncellenmesi gerekecektir.