# blueprints/firma.py

import logging
from flask import Blueprint, jsonify, render_template, request, session
# YENİ: firma_yetkilisi_required decorator'ını import ediyoruz
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required
from services import firma_service
# YENİ: Tedarikçi servisini de import ediyoruz (kullanıcı detayında tüm tedarikçileri listelemek için)
from services.tedarikci_service import tedarikci_service
from constants import UserRole # <-- BU IMPORT'U EKLE (eğer yoksa)


logger = logging.getLogger(__name__)
firma_bp = Blueprint('firma', __name__, url_prefix='/firma')

@firma_bp.route('/yonetim')
@login_required
@lisans_kontrolu
@firma_yetkilisi_required
def firma_yonetim_sayfasi():
    """Firma yetkilisinin toplayıcı ve muhasebeci yönettiği arayüz sayfasını render eder."""
    # Bu fonksiyon aynı kalıyor
    return render_template('firma_yonetimi.html')

@firma_bp.route('/api/yonetim_data', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_yonetim_data_api():
    """Yönetim sayfası için kullanıcı listesini ve lisans limitini getirir."""
    # Bu fonksiyon aynı kalıyor
    try:
        sirket_id = session['user']['sirket_id']
        data = firma_service.get_kullanicilar_by_sirket_id(sirket_id)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Firma yönetim verileri alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Yönetim verileri alınamadı."}), 500

@firma_bp.route('/api/toplayici_ekle', methods=['POST'])
@login_required
@firma_yetkilisi_required
def add_toplayici_api():
    """Yeni bir toplayıcı veya muhasebeci kullanıcı ekler."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        # --- ÖNEMLİ DÜZELTME BURADA ---
        # Eğer test script'i 'rol' göndermezse
        # (veya JS 'rol' göndermezse)
        # 'rol'ü 'toplayici' olarak manuel ekle.
        if 'rol' not in data:
            data['rol'] = UserRole.TOPLAYICI.value # 'toplayici'
        # --- DÜZELTME SONU ---
            
        yeni_kullanici = firma_service.add_kullanici(sirket_id, data)
        return jsonify({"message": "Kullanıcı başarıyla eklendi.", "kullanici": yeni_kullanici}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Toplayıcı ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Toplayıcı eklenirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_sil/<int:kullanici_id>', methods=['DELETE'])
@login_required
@firma_yetkilisi_required
def delete_kullanici_api(kullanici_id):
    """Bir kullanıcıyı (toplayıcı/muhasebeci/çiftçi) siler."""
    # Bu fonksiyon aynı kalıyor (servis katmanı rol kontrolü yapıyor)
    try:
        sirket_id = session['user']['sirket_id']
        firma_service.delete_kullanici(sirket_id, kullanici_id)
        return jsonify({"message": "Kullanıcı başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı silinirken bir sunucu hatası oluştu."}), 500

# blueprints/firma.py içindeki get_kullanici_detay_api fonksiyonunu BUNUNLA DEĞİİŞTİR

# Bu importun en üstte olduğundan emin ol:
from services.tedarikci_service import tedarikci_service

@firma_bp.route('/api/kullanici_detay/<int:kullanici_id>', methods=['GET'])
@login_required
@firma_yetkilisi_required
def get_kullanici_detay_api(kullanici_id):
    """Bir kullanıcının düzenleme için detaylarını VE tüm tedarikçileri getirir."""
    try:
        sirket_id = session['user']['sirket_id']
        
        # 1. Kullanıcının kendi detaylarını (ve atanmış ID'lerini) al
        # (Fonksiyon adını '...detaylari' olarak düzelttik)
        kullanici_detaylari = firma_service.get_kullanici_detaylari(sirket_id, kullanici_id)
        
        if not kullanici_detaylari:
            return jsonify({"error": "Kullanıcı bulunamadı."}), 404

        # 2. Modal'daki seçim kutusunu doldurmak için TÜM tedarikçileri al
        # (Senin orijinal kodundaki doğru mantık buydu)
        tum_tedarikciler = tedarikci_service.get_all_for_dropdown(sirket_id)
        
        # 3. İkisini birlikte döndür
        return jsonify({
            "kullanici_detay": kullanici_detaylari,
            "tum_tedarikciler": tum_tedarikciler
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı detayı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı detayları alınamadı."}), 500

@firma_bp.route('/api/kullanici_guncelle/<int:kullanici_id>', methods=['PUT'])
@login_required
@firma_yetkilisi_required
def update_kullanici_api(kullanici_id):
    """Bir kullanıcının bilgilerini, şifresini ve tedarikçi atamalarını günceller."""
    # Bu fonksiyon aynı kalıyor
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        success = firma_service.update_kullanici(sirket_id, kullanici_id, data)
        if success:
            return jsonify({"message": "Kullanıcı bilgileri başarıyla güncellendi."})
        else:
             raise Exception("Güncelleme işlemi başarısız oldu.")
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı güncellenirken bir sunucu hatası oluştu."}), 500

# --- GÜNCELLENDİ: Artık sadece çiftçi değil, kullanıcı şifresini ayarlar ---
@firma_bp.route('/api/kullanici_sifre_setle/<int:kullanici_id>', methods=['POST']) # URL değişti
@login_required
@firma_yetkilisi_required
def set_user_password_api(kullanici_id): # Fonksiyon adı değişti
    """Bir kullanıcının (çiftçi, toplayıcı, muhasebeci) şifresini firma yetkilisinin belirlediği yeni şifre ile günceller."""
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        yeni_sifre = data.get('yeni_sifre') # JSON body'den yeni şifreyi al

        if not yeni_sifre:
            return jsonify({"error": "Yeni şifre gönderilmedi."}), 400

        # Yeni, genelleştirilmiş servis fonksiyonunu çağır
        # (Bir önceki adımda services/firma_service.py'da adını set_user_password yapmıştık)
        firma_service.set_user_password(sirket_id, kullanici_id, yeni_sifre) 

        return jsonify({"message": "Kullanıcı şifresi başarıyla güncellendi."})

    except ValueError as ve:
        # Servisten gelen validation hatalarını döndür
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı şifre ayarlama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Şifre ayarlanırken bir sunucu hatası oluştu."}), 500
