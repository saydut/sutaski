# blueprints/admin.py

from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, admin_required
from services.admin_service import admin_service

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin')
@login_required
@admin_required
def admin_panel():
    kullanici_adi = session.get('user', {}).get('kullanici_adi', 'Admin')
    return render_template('admin.html', kullanici_adi=kullanici_adi)

@admin_bp.route('/api/admin/data')
@login_required
@admin_required
def get_admin_data():
    try:
        data = admin_service.get_all_data()
        return jsonify(data)
    except Exception:
        return jsonify({"error": "Admin verileri alınırken bir sunucu hatası oluştu."}), 500

@admin_bp.route('/api/admin/update_lisans', methods=['POST'])
@login_required
@admin_required
def update_lisans():
    try:
        data = request.get_json()
        admin_service.update_license(data['sirket_id'], data.get('yeni_tarih'))
        return jsonify({"message": "Lisans tarihi başarıyla güncellendi!"})
    except Exception:
        return jsonify({"error": "Lisans güncellenirken bir sunucu hatası oluştu."}), 500
        
@admin_bp.route('/api/admin/update_rol', methods=['POST'])
@login_required
@admin_required
def update_rol():
    try:
        data = request.get_json()
        admin_service.update_user_role(data['kullanici_id'], data.get('yeni_rol'))
        return jsonify({"message": "Kullanıcı rolü başarıyla güncellendi!"})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Rol güncellenirken bir sunucu hatası oluştu."}), 500

@admin_bp.route('/api/admin/delete_company', methods=['POST'])
@login_required
@admin_required
def delete_company():
    try:
        data = request.get_json()
        admin_service.delete_company(data['sirket_id'])
        return jsonify({"message": "Şirket ve tüm bağlı verileri başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception:
        return jsonify({"error": "Şirket silinirken bir sunucu hatası oluştu."}), 500

@admin_bp.route('/api/admin/reset_password', methods=['POST'])
@login_required
@admin_required
def reset_password():
    try:
        data = request.get_json()
        admin_service.reset_password(data.get('kullanici_id'), data.get('yeni_sifre'))
        return jsonify({"message": "Kullanıcı şifresi başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Şifre sıfırlanırken bir sunucu hatası oluştu."}), 500

@admin_bp.route('/api/admin/cache_version', methods=['GET'])
@login_required
@admin_required
def get_cache_version():
    try:
        version = admin_service.get_cache_version()
        return jsonify({"version": version})
    except Exception:
        return jsonify({"error": "Önbellek sürümü alınamadı."}), 500

@admin_bp.route('/api/admin/increment_cache_version', methods=['POST'])
@login_required
@admin_required
def increment_cache_version():
    try:
        new_version = admin_service.increment_cache_version()
        return jsonify({"message": f"Önbellek sürümü başarıyla v{new_version}'e yükseltildi!", "new_version": new_version})
    except Exception:
        return jsonify({"error": "Önbellek sürümü yükseltilemedi."}), 500

@admin_bp.route('/api/admin/maintenance_status', methods=['GET'])
@login_required
@admin_required
def get_maintenance_status():
    try:
        is_maintenance = admin_service.get_maintenance_status()
        return jsonify({"is_maintenance_mode": is_maintenance})
    except Exception:
        return jsonify({"error": "Bakım modu durumu alınamadı."}), 500

@admin_bp.route('/api/admin/toggle_maintenance', methods=['POST'])
@login_required
@admin_required
def toggle_maintenance_mode():
    try:
        yeni_durum = request.get_json().get('maintenance_mode', False)
        admin_service.set_maintenance_status(yeni_durum)
        mesaj = "Uygulama başarıyla bakım moduna alındı." if yeni_durum else "Uygulama bakım modundan çıkarıldı."
        return jsonify({"message": mesaj})
    except Exception:
        return jsonify({"error": "Bakım modu değiştirilemedi."}), 500

@admin_bp.route('/api/admin/surum_notlari', methods=['GET', 'POST'])
@login_required
@admin_required
def handle_surum_notlari():
    try:
        if request.method == 'GET':
            notlar = admin_service.get_all_version_notes()
            return jsonify(notlar)
        elif request.method == 'POST':
            admin_service.add_version_note(request.get_json())
            return jsonify({"message": "Sürüm notu başarıyla eklendi."}), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Sürüm notları işlenirken bir hata oluştu."}), 500

@admin_bp.route('/api/admin/surum_notlari/<int:id>', methods=['PUT', 'DELETE'])
@login_required
@admin_required
def handle_surum_notu(id):
    try:
        if request.method == 'PUT':
            admin_service.update_version_note(id, request.get_json())
            return jsonify({"message": "Sürüm notu başarıyla güncellendi."})
        elif request.method == 'DELETE':
            admin_service.delete_version_note(id)
            return jsonify({"message": "Sürüm notu başarıyla silindi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception:
        return jsonify({"error": "Sürüm notu işlenirken bir hata oluştu."}), 500

@admin_bp.route('/api/admin/send_notification', methods=['POST'])
@login_required
@admin_required
def send_notification_to_user():
    """Belirli bir kullanıcıya admin panelinden bildirim gönderir."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        title = data.get('title')
        body = data.get('body')

        if not all([user_id, title, body]):
            return jsonify({"error": "Kullanıcı ID, başlık ve içerik alanları zorunludur."}), 400
        
        from services.push_service import push_service
        sent_count = push_service.send_notification_to_user(user_id=user_id, title=title, body=body)

        if sent_count > 0:
            return jsonify({"message": f"Bildirim, kullanıcının {sent_count} cihazına başarıyla gönderildi."})
        else:
            return jsonify({"error": "Kullanıcının kayıtlı bir bildirim aboneliği bulunamadı."}), 404

    except Exception:
        return jsonify({"error": "Bildirim gönderilirken bir sunucu hatası oluştu."}), 500
