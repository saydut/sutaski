# blueprints/admin.py
# Yeni RLS-bypass servis (admin_service) yanıt formatına göre güncellendi.

import logging
from flask import Blueprint, jsonify, render_template, request, g
# Yeni '@role_required' decorator'ını ve UserRole sabitlerini kullanalım
from decorators import login_required, role_required
from constants import UserRole
from services.admin_service import admin_service

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/')
@login_required
@role_required(UserRole.ADMIN.value) # Sadece süper admin ('admin')
def admin_paneli():
    """Süper Admin ana panelini render eder."""
    return render_template('admin.html')

# --- API ROTALARI ---

@admin_bp.route('/api/dashboard_stats', methods=['GET'])
@login_required
@role_required(UserRole.ADMIN.value)
def get_dashboard_stats_api():
    """Admin paneli için temel istatistikleri çeker."""
    try:
        # Servis artık (data, error) döndürüyor
        data, error = admin_service.get_admin_dashboard_data()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(data)
    except Exception as e:
        logger.error(f"Admin dashboard stats API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/sirketler', methods=['GET'])
@login_required
@role_required(UserRole.ADMIN.value)
def get_sirketler_api():
    """Tüm şirketleri sayfalayarak listeler."""
    try:
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        
        # Servis artık (data, count, error) döndürüyor
        sirketler, toplam_kayit, error = admin_service.get_all_sirketler(sayfa, limit)
        
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({
            "sirketler": sirketler,
            "toplam_kayit": toplam_kayit,
            "sayfa": sayfa,
            "limit": limit
        })
    except Exception as e:
        logger.error(f"Admin sirket listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/sirketler/lisans_guncelle/<int:sirket_id>', methods=['PUT'])
@login_required
@role_required(UserRole.ADMIN.value)
def update_lisans_api(sirket_id):
    """Bir şirketin lisans bitiş tarihini günceller."""
    try:
        data = request.get_json()
        # Servis artık (data, error) döndürüyor
        guncel_sirket, error = admin_service.update_sirket_lisans(sirket_id, data)
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": "Lisans başarıyla güncellendi.", "sirket": guncel_sirket})
    except Exception as e:
        logger.error(f"Admin lisans güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/surum_notlari', methods=['GET'])
@login_required
@role_required(UserRole.ADMIN.value)
def get_surum_notlari_api():
    """Sürüm notlarını sayfalayarak listeler."""
    try:
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = request.args.get('limit', 5, type=int)
        
        # Servis artık (data, count, error) döndürüyor
        notlar, toplam_kayit, error = admin_service.get_all_surum_notlari(sayfa, limit)
        
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify({
            "notlar": notlar,
            "toplam_kayit": toplam_kayit,
            "sayfa": sayfa,
            "limit": limit
        })
    except Exception as e:
        logger.error(f"Admin sürüm notları listeleme API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/surum_notlari', methods=['POST'])
@login_required
@role_required(UserRole.ADMIN.value)
def add_surum_notu_api():
    """Yeni bir sürüm notu ekler."""
    try:
        data = request.get_json()
        # Servis artık (data, error) döndürüyor
        yeni_not, error = admin_service.add_surum_notu(data)
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": "Sürüm notu başarıyla eklendi.", "not": yeni_not}), 201
    except Exception as e:
        logger.error(f"Admin sürüm notu ekleme API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/surum_notlari/<int:not_id>', methods=['DELETE'])
@login_required
@role_required(UserRole.ADMIN.value)
def delete_surum_notu_api(not_id):
    """Bir sürüm notunu siler."""
    try:
        # Servis artık (data, error) döndürüyor
        success, error = admin_service.delete_surum_notu(not_id)
        if error:
            return jsonify({"error": error}), 404
        return jsonify({"message": "Sürüm notu başarıyla silindi."})
    except Exception as e:
        logger.error(f"Admin sürüm notu silme API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/ayarlar', methods=['GET'])
@login_required
@role_required(UserRole.ADMIN.value)
def get_ayarlar_api():
    """Global ayarları çeker."""
    try:
        # Servis artık (data, error) döndürüyor
        ayarlar, error = admin_service.get_global_settings()
        if error:
            return jsonify({"error": error}), 500
        return jsonify(ayarlar)
    except Exception as e:
        logger.error(f"Admin ayarlar (GET) API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/ayarlar', methods=['POST'])
@login_required
@role_required(UserRole.ADMIN.value)
def update_ayarlar_api():
    """Global ayarları günceller (Upsert)."""
    try:
        data = request.get_json()
        # Servis artık (data, error) döndürüyor
        success, error = admin_service.update_global_settings(data)
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify({"message": "Ayarlar başarıyla güncellendi."})
    except Exception as e:
        logger.error(f"Admin ayarlar (POST) API hatası: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500