# blueprints/firma.py

import logging
# DÜZELTME: 'g' objesini ve 'session'ı kullanmak için import ediyoruz
from flask import Blueprint, jsonify, render_template, request, session, g 
from decorators import login_required, lisans_kontrolu, role_required
from constants import UserRole 

# DÜZELTME: Artık 'FirmaService' (Class) ve 'tedarikci_service' (objesini) import ediyoruz
# Döngüsel İçe Aktarma hatasını (ImportError) çözmek için:
# 'FirmaService'in kendisini (Class) import ediyoruz, objesini (instance) değil.
from services.firma_service import FirmaService 
from services.tedarikci_service import tedarikci_service # Bunun 'g' kullanmadığını varsayıyoruz

logger = logging.getLogger(__name__)
firma_bp = Blueprint('firma', __name__, url_prefix='/firma')

@firma_bp.route('/yonetim')
@login_required
@lisans_kontrolu # Eksik olan decorator'ı (artık decorators.py'de) çağırıyoruz
@role_required(UserRole.FIRMA_YETKILISI) # Sadece firma yetkilisi girebilir
def firma_yonetim_sayfasi():
    """Firma yetkilisinin kullanıcıları yönettiği arayüz sayfasını render eder."""
    return render_template('firma_yonetimi.html')

# --- API ROTALARI ---

@firma_bp.route('/api/yonetim_data', methods=['GET'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def get_yonetim_data_api():
    """Yönetim sayfası için kullanıcı listesini getirir."""
    # DÜZELTME: Servis objesini (instance) fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        
        # DÜZELTME: Servise 'g.supabase' istemcisini parametre olarak veriyoruz
        data = firma_service_instance.get_yonetim_data(g.supabase, sirket_id)
        
        # --- ANA DÜZELTME (Format Hatası): ---
        # JavaScript bir DİZİ ([...]) bekliyor. Biz 'data' objesini değil,
        # içindeki 'kullanicilar' DİZİSİNİ yollamalıyız.
        return jsonify(data["kullanicilar"])
        # --- DÜZELTME SONU ---
        
    except Exception as e:
        logger.error(f"Firma yönetim verileri alınırken hata: {e}", exc_info=True)
        return jsonify({"error": f"Yönetim verileri alınamadı: {str(e)}"}), 500

# --- DÜZELTME: JS DOSYASIYLA UYUM ---
# static/js/firma_yonetimi.js dosyası 3 farklı URL'e POST isteği atıyor:
# 1. /api/toplayici_ekle
# 2. /api/ciftci_ekle
# 3. /api/kullanici_ekle (muhasebeci için)
# Bu 3 rotayı da karşılayan GENEL BİR 'add_kullanici_api' fonksiyonu oluşturuyoruz.

@firma_bp.route('/api/toplayici_ekle', methods=['POST'])
@firma_bp.route('/api/ciftci_ekle', methods=['POST'])
@firma_bp.route('/api/kullanici_ekle', methods=['POST'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def add_kullanici_api(): 
    """Yeni bir kullanıcı (toplayıcı, çiftçi, muhasebeci) ekler."""
    
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        # DÜZELTME: Servise 'g.supabase' istemcisini parametre olarak veriyoruz
        # services/firma_service.py içindeki 'add_kullanici' fonksiyonu
        # 'rol'ü 'data' içinden alacak şekilde güncellendi.
        yeni_kullanici = firma_service_instance.add_kullanici(g.supabase, sirket_id, data)
        
        # Frontend'in (firma_yonetimi.js) beklediği format (result.data)
        return jsonify({"message": "Kullanıcı başarıyla eklendi.", "data": yeni_kullanici}), 201
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı eklenirken bir sunucu hatası oluştu."}), 500


@firma_bp.route('/api/kullanici_sil/<int:kullanici_id>', methods=['DELETE'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def delete_kullanici_api(kullanici_id):
    """Bir kullanıcıyı (toplayıcı/muhasebeci/çiftçi) siler."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        
        # DÜZELTME: Servise 'g.supabase' istemcisini parametre olarak veriyoruz
        firma_service_instance.delete_kullanici(g.supabase, sirket_id, kullanici_id)
        
        return jsonify({"message": "Kullanıcı başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı silme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı silinirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_detay/<int:kullanici_id>', methods=['GET'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def get_kullanici_detay_api(kullanici_id):
    """Bir kullanıcının düzenleme için detaylarını ve atanmış tedarikçilerini getirir."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    
    try:
        sirket_id = session['user']['sirket_id']
        
        # Servis fonksiyonlarını 'g.supabase' ile çağır
        kullanici_detaylari = firma_service_instance.get_kullanici_detay(g.supabase, sirket_id, kullanici_id)
        
        # tedarikci_service'in 'g' kullanmadığını varsayıyoruz (eğer hata verirse onu da düzeltiriz)
        tum_tedarikciler = tedarikci_service.get_all_for_dropdown(sirket_id) 
        
        # Frontend'in (firma_yonetimi.js) beklediği formatta birleştir
        return jsonify({
            "kullanici_detay": kullanici_detaylari["kullanici"],
            "atanan_tedarikciler": kullanici_detaylari["atanan_tedarikciler"],
            "tum_tedarikciler": tum_tedarikciler
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        logger.error(f"Kullanıcı detayı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı detayları alınamadı."}), 500

@firma_bp.route('/api/kullanici_guncelle/<int:kullanici_id>', methods=['PUT'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def update_kullanici_api(kullanici_id):
    """Bir kullanıcının bilgilerini, şifresini ve tedarikçi atamalarını günceller."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        
        # DÜZELTME: Servise 'g.supabase' istemcisini parametre olarak veriyoruz
        success = firma_service_instance.update_kullanici(g.supabase, sirket_id, kullanici_id, data)
        
        if success:
            return jsonify({"message": "Kullanıcı bilgileri başarıyla güncellendi."})
        else:
             raise Exception("Güncelleme işlemi başarısız oldu.")
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": "Kullanıcı güncellenirken bir sunucu hatası oluştu."}), 500

@firma_bp.route('/api/kullanici_sifre_setle/<int:kullanici_id>', methods=['POST'])
@login_required
@role_required(UserRole.FIRMA_YETKILISI)
def set_user_password_api(kullanici_id):
    """Bir kullanıcının (çiftçi, toplayıcı, muhasebeci) şifresini ayarlar."""
    # DÜZELTME: Servis objesini fonksiyon içinde oluşturuyoruz
    firma_service_instance = FirmaService()
    try:
        sirket_id = session['user']['sirket_id']
        data = request.get_json()
        yeni_sifre = data.get('yeni_sifre')

        if not yeni_sifre:
            return jsonify({"error": "Yeni şifre gönderilmedi."}), 400

        # DÜZELTME: Servise 'g.supabase' istemcisini parametre olarak veriyoruz
        firma_service_instance.set_user_password(g.supabase, sirket_id, kullanici_id, yeni_sifre) 

        return jsonify({"message": "Kullanıcı şifresi başarıyla güncellendi."})

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Kullanıcı şifre ayarlama API hatası: {e}", exc_info=True)
        return jsonify({"error": "Şifre ayarlanırken bir sunucu hatası oluştu."}), 500