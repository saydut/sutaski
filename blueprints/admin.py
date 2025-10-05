# blueprints/admin.py (DİNAMİK ÖNBELLEK YÖNETİMİ EKLENDİ)

from flask import Blueprint, jsonify, render_template, request, session
from extensions import supabase, bcrypt
from decorators import login_required, admin_required
from constants import UserRole
from postgrest import APIError

admin_bp = Blueprint('admin', __name__)

# --- ARAYÜZ SAYFALARI (ADMIN) ---

@admin_bp.route('/admin')
@login_required
@admin_required
def admin_panel():
    kullanici_adi = session.get('user', {}).get('kullanici_adi', 'Admin')
    return render_template('admin.html', kullanici_adi=kullanici_adi)

# --- API ADRESLERİ (ADMIN) ---

@admin_bp.route('/api/admin/data')
@login_required
@admin_required
def get_admin_data():
    try:
        sirketler = supabase.table('sirketler').select('*').execute()
        kullanicilar = supabase.table('kullanicilar').select('*, sirketler(sirket_adi)').execute()
        return jsonify({"sirketler": sirketler.data, "kullanicilar": kullanicilar.data})
    except Exception as e:
        print(f"Admin veri hatası: {e}")
        return jsonify({"error": "Veri alınırken sunucuda bir hata oluştu."}), 500

# --- YENİ FONKSİYONLAR: ÖNBELLEK YÖNETİMİ (GÜNCELLENDİ) ---
@admin_bp.route('/api/admin/cache_version', methods=['GET'])
@login_required
@admin_required
def get_cache_version():
    try:
        # .single() yerine .limit(1).single() kullanarak birden fazla kayıt olsa bile hata almayı önlüyoruz.
        response = supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'cache_version').limit(1).single().execute()
        version = response.data.get('ayar_degeri', '1') if response.data else '1'
        return jsonify({"version": version})
    except Exception as e:
        print(f"Önbellek sürümü alınırken hata: {e}")
        return jsonify({"error": "Önbellek sürümü alınamadı."}), 500

@admin_bp.route('/api/admin/increment_cache_version', methods=['POST'])
@login_required
@admin_required
def increment_cache_version():
    try:
        # Mevcut sürümü alırken daha güvenli bir yöntem kullanıyoruz.
        get_response = supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'cache_version').limit(1).single().execute()
        
        if not get_response.data:
            # Eğer ayar yoksa, oluştur ve 1'den başlat
            supabase.table('ayarlar').insert({'ayar_adi': 'cache_version', 'ayar_degeri': '2'}).execute()
            return jsonify({"message": "Önbellek ayarı oluşturuldu ve sürüm v2 olarak ayarlandı.", "new_version": 2})

        current_version = int(get_response.data.get('ayar_degeri', '1'))
        new_version = current_version + 1
        
        # Yeni sürümü veritabanına kaydet
        supabase.table('ayarlar').update({'ayar_degeri': str(new_version)}).eq('ayar_adi', 'cache_version').execute()
        
        return jsonify({"message": f"Önbellek sürümü başarıyla v{new_version}'e yükseltildi!", "new_version": new_version})
    except Exception as e:
        print(f"Önbellek sürümü artırılırken hata: {e}")
        return jsonify({"error": "Önbellek sürümü güncellenemedi."}), 500
# --- ÖNBELLEK YÖNETİMİ SONU ---

@admin_bp.route('/api/admin/update_lisans', methods=['POST'])
@login_required
@admin_required
def update_lisans():
    try:
        data = request.get_json()
        sirket_id = data['sirket_id']
        yeni_tarih = data.get('yeni_tarih')
        if not yeni_tarih or yeni_tarih == "":
            yeni_tarih = None
        supabase.table('sirketler').update({'lisans_bitis_tarihi': yeni_tarih}).eq('id', sirket_id).execute()
        return jsonify({"message": "Lisans tarihi başarıyla güncellendi!"})
    except Exception as e:
        print(f"Lisans güncelleme hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500
        
@admin_bp.route('/api/admin/update_rol', methods=['POST'])
@login_required
@admin_required
def update_rol():
    try:
        data = request.get_json()
        kullanici_id = data['kullanici_id']
        yeni_rol = data.get('yeni_rol')
        
        # DEĞİŞİKLİK: Rolleri hard-code yazmak yerine Enum'dan dinamik olarak alıyoruz.
        gecerli_roller = [rol.value for rol in UserRole]
        if yeni_rol not in gecerli_roller:
            return jsonify({"error": "Geçersiz rol."}), 400
            
        supabase.table('kullanicilar').update({'rol': yeni_rol}).eq('id', kullanici_id).execute()
        return jsonify({"message": "Kullanıcı rolü başarıyla güncellendi!"})
    except Exception as e:
        print(f"Rol güncelleme hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@admin_bp.route('/api/admin/delete_company', methods=['POST'])
@login_required
@admin_required
def delete_company():
    try:
        data = request.get_json()
        sirket_id = data['sirket_id']

        if not sirket_id:
            return jsonify({"error": "Şirket ID'si belirtilmedi."}), 400
        
        # TEK BİR SİLME İŞLEMİ YETERLİ!
        # Veritabanındaki ON DELETE CASCADE kuralları geri kalan her şeyi
        # atomik ve güvenli bir şekilde halledecektir.
        response = supabase.table('sirketler').delete().eq('id', sirket_id).execute()

        # Silinecek bir şey bulunamadıysa hata verelim.
        if not response.data:
            return jsonify({"error": "Silinecek şirket bulunamadı."}), 404

        return jsonify({"message": "Şirket ve tüm bağlı verileri başarıyla silindi."})

    except Exception as e:
        print(f"Şirket silme hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@admin_bp.route('/api/admin/reset_password', methods=['POST'])
@login_required
@admin_required
def reset_password():
    try:
        data = request.get_json()
        kullanici_id = data.get('kullanici_id')
        yeni_sifre = data.get('yeni_sifre')

        if not kullanici_id or not yeni_sifre:
            return jsonify({"error": "Kullanıcı ID'si ve yeni şifre gereklidir."}), 400

        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')

        supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id).execute()
        
        return jsonify({"message": "Kullanıcı şifresi başarıyla güncellendi."})
    except Exception as e:
        print(f"Şifre sıfırlama hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

# --- SÜRÜM YÖNETİMİ API'LARI ---

@admin_bp.route('/api/admin/surum_notlari', methods=['GET'])
@login_required
@admin_required
def get_surum_notlari():
    """Tüm sürüm notlarını veritabanından çeker."""
    try:
        # --- DÜZELTME: Tarih eşitliği durumları için ID'ye göre ikincil sıralama eklendi ---
        notlar = supabase.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()
        return jsonify(notlar.data)
    except Exception as e:
        print(f"Sürüm notları alınırken hata: {e}")
        return jsonify({"error": "Sürüm notları alınamadı."}), 500

@admin_bp.route('/api/admin/surum_notlari', methods=['POST'])
@login_required
@admin_required
def add_surum_notu():
    """Yeni bir sürüm notu ekler."""
    try:
        data = request.get_json()
        surum_no = data.get('surum_no')
        yayin_tarihi = data.get('yayin_tarihi')
        notlar = data.get('notlar')

        if not all([surum_no, yayin_tarihi, notlar]):
            return jsonify({"error": "Tüm alanlar zorunludur."}), 400

        yeni_not = {
            "surum_no": surum_no,
            "yayin_tarihi": yayin_tarihi,
            "notlar": notlar
        }
        supabase.table('surum_notlari').insert(yeni_not).execute()
        return jsonify({"message": "Sürüm notu başarıyla eklendi."}), 201
    except Exception as e:
        print(f"Sürüm notu eklenirken hata: {e}")
        return jsonify({"error": "Sürüm notu eklenemedi."}), 500

# YENİ EKLENEN FONKSİYON
@admin_bp.route('/api/admin/surum_notlari/<int:id>', methods=['PUT'])
@login_required
@admin_required
def update_surum_notu(id):
    """Bir sürüm notunu günceller."""
    try:
        data = request.get_json()
        surum_no = data.get('surum_no')
        yayin_tarihi = data.get('yayin_tarihi')
        notlar = data.get('notlar')

        if not all([surum_no, yayin_tarihi, notlar]):
            return jsonify({"error": "Tüm alanlar zorunludur."}), 400

        guncel_veri = {
            "surum_no": surum_no,
            "yayin_tarihi": yayin_tarihi,
            "notlar": notlar
        }
        response = supabase.table('surum_notlari').update(guncel_veri).eq('id', id).execute()

        if not response.data:
                return jsonify({"error": "Güncellenecek sürüm notu bulunamadı."}), 404

        return jsonify({"message": "Sürüm notu başarıyla güncellendi."})
    except Exception as e:
        print(f"Sürüm notu güncellenirken hata: {e}")
        return jsonify({"error": "Sürüm notu güncellenemedi."}), 500

@admin_bp.route('/api/admin/surum_notlari/<int:id>', methods=['DELETE'])
@login_required
@admin_required
def delete_surum_notu(id):
    """Bir sürüm notunu siler."""
    try:
        supabase.table('surum_notlari').delete().eq('id', id).execute()
        return jsonify({"message": "Sürüm notu başarıyla silindi."})
    except Exception as e:
        print(f"Sürüm notu silinirken hata: {e}")
        return jsonify({"error": "Sürüm notu silinemedi."}), 500