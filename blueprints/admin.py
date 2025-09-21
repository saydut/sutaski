from flask import Blueprint, jsonify, render_template, request, session
from extensions import supabase, bcrypt
from decorators import login_required, admin_required

# Admin blueprint'ini oluşturuyoruz.
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
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500
        
@admin_bp.route('/api/admin/update_rol', methods=['POST'])
@login_required
@admin_required
def update_rol():
    try:
        data = request.get_json()
        kullanici_id = data['kullanici_id']
        yeni_rol = data.get('yeni_rol')
        
        if yeni_rol not in ['user', 'admin', 'muhasebeci']:
            return jsonify({"error": "Geçersiz rol."}), 400
            
        supabase.table('kullanicilar').update({'rol': yeni_rol}).eq('id', kullanici_id).execute()
        return jsonify({"message": "Kullanıcı rolü başarıyla güncellendi!"})
    except Exception as e:
        print(f"Rol güncelleme hatası: {e}")
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/admin/delete_company', methods=['POST'])
@login_required
@admin_required
def delete_company():
    try:
        data = request.get_json()
        sirket_id = data['sirket_id']

        if not sirket_id:
            return jsonify({"error": "Şirket ID'si belirtilmedi."}), 400
        
        kullanicilar = supabase.table('kullanicilar').select('id').eq('sirket_id', sirket_id).execute().data
        kullanici_idler = [k['id'] for k in kullanicilar]

        if kullanici_idler:
            girdiler = supabase.table('sut_girdileri').select('id').in_('kullanici_id', kullanici_idler).execute().data
            girdi_idler = [g['id'] for g in girdiler]
            if girdi_idler:
                supabase.table('girdi_gecmisi').delete().in_('orijinal_girdi_id', girdi_idler).execute()
            supabase.table('sut_girdileri').delete().in_('kullanici_id', kullanici_idler).execute()
        
        supabase.table('tedarikciler').delete().eq('sirket_id', sirket_id).execute()
        supabase.table('kullanicilar').delete().eq('sirket_id', sirket_id).execute()
        supabase.table('sirketler').delete().eq('id', sirket_id).execute()

        return jsonify({"message": f"Şirket ve tüm verileri başarıyla silindi."})

    except Exception as e:
        print(f"Şirket silme hatası: {e}")
        return jsonify({"error": str(e)}), 500

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
        return jsonify({"error": str(e)}), 500
