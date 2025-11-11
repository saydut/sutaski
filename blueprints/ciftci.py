# blueprints/ciftci.py
# RLS ve yeni 'ciftci' rolü mantığına göre güncellendi.

import logging
from flask import Blueprint, jsonify, render_template, request, g, session
# 'role_required' decorator'ını ve 'UserRole' sabitlerini kullan
from decorators import login_required, role_required
from constants import UserRole
from extensions import supabase_client
from decimal import Decimal

logger = logging.getLogger(__name__)
ciftci_bp = Blueprint('ciftci', __name__, url_prefix='/ciftci')

@ciftci_bp.route('/panel')
@login_required
@role_required(UserRole.CIFCI.value) # Sadece 'ciftci' rolü girebilir
def ciftci_paneli():
    """Çiftçi rolündeki kullanıcının ana panelini render eder."""
    # 'g.profile' @login_required tarafından dolduruldu
    kullanici_adi = g.profile.get('kullanici_adi', 'Çiftçi')
    return render_template('ciftci_panel.html', kullanici_adi=kullanici_adi)

# --- API ROTALARI (ÇİFTÇİ PANELİ İÇİN) ---

@ciftci_bp.route('/api/panel_data')
@login_required
@role_required(UserRole.CIFCI.value)
def get_ciftci_panel_data_api():
    """
    Çiftçi paneli için gerekli tüm verileri (Özet, son işlemler)
    yeni RPC fonksiyonunu (get_ciftci_panel_data) kullanarak çeker.
    """
    try:
        # 1. Kullanıcı UUID'sini 'g' objesinden al
        kullanici_id_uuid = g.user.id
        
        # 2. Yeni RLS'e uyumlu RPC'yi çağır
        response = supabase_client.rpc('get_ciftci_panel_data', {
            'p_kullanici_id': kullanici_id_uuid
        }).execute()
        
        if not response.data:
            return jsonify({"error": "Çiftçi verisi bulunamadı veya RPC hatası."}), 404
        
        # 3. Veriyi formatla (RPC'den gelen özeti Decimal'e çevir)
        data = response.data
        summary = data.get('summary', {})
        formatted_summary = {
            "toplam_sut_alacagi": f"{Decimal(summary.get('toplam_sut_alacagi', 0)):.2f}",
            "toplam_yem_borcu": f"{Decimal(summary.get('toplam_yem_borcu', 0)):.2f}",
            "toplam_sirket_odemesi": f"{Decimal(summary.get('toplam_sirket_odemesi', 0)):.2f}",
            "toplam_tahsilat": f"{Decimal(summary.get('toplam_tahsilat', 0)):.2f}",
            "net_bakiye": f"{Decimal(summary.get('net_bakiye', 0)):.2f}"
        }
        data['summary'] = formatted_summary # Özeti formatlanmışıyla değiştir

        return jsonify(data)
        
    except Exception as e:
        logger.error(f"Çiftçi panel verisi (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Panel verileri alınırken bir hata oluştu."}), 500

@ciftci_bp.route('/api/sut_girdileri')
@login_required
@role_required(UserRole.CIFCI.value)
def get_ciftci_sut_girdileri_api():
    """Çiftçinin KENDİ süt girdilerini sayfalı olarak çeker."""
    try:
        # Çiftçinin tedarikçi ID'sini RLS kullanarak al
        # (SQL'de çiftçinin sadece kendi kaydını görme politikası ekledik)
        tedarikci_res = supabase_client.table('tedarikciler') \
            .select('id') \
            .eq('kullanici_id', g.user.id) \
            .single() \
            .execute()
        
        if not tedarikci_res.data:
            return jsonify({"error": "İlişkili tedarikçi kaydı bulunamadı."}), 404
        
        tedarikci_id = tedarikci_res.data['id']
        
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = 10
        offset = (sayfa - 1) * limit

        # Kendi tedarikçi ID'si ile RLS'e tabi olarak sorgula
        response = supabase_client.table('sut_girdileri') \
            .select('taplanma_tarihi, litre, fiyat, toplam_tutar:fiyat', count='exact') \
            .eq('tedarikci_id', tedarikci_id) \
            .order('taplanma_tarihi', desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
            
        # Toplam tutarı manuel hesapla (fiyat * litre)
        for item in response.data:
            item['toplam_tutar'] = f"{Decimal(item.get('litre', 0)) * Decimal(item.get('fiyat', 0)):.2f}"

        return jsonify({"data": response.data, "count": response.count})
        
    except Exception as e:
        logger.error(f"Çiftçi süt girdileri (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Süt girdileri alınırken bir hata oluştu."}), 500

@ciftci_bp.route('/api/yem_islemleri')
@login_required
@role_required(UserRole.CIFCI.value)
def get_ciftci_yem_islemleri_api():
    """Çiftçinin KENDİ yem işlemlerini sayfalı olarak çeker."""
    try:
        tedarikci_res = supabase_client.table('tedarikciler') \
            .select('id') \
            .eq('kullanici_id', g.user.id) \
            .single() \
            .execute()
        
        if not tedarikci_res.data:
            return jsonify({"error": "İlişkili tedarikçi kaydı bulunamadı."}), 404
            
        tedarikci_id = tedarikci_res.data['id']
        
        sayfa = request.args.get('sayfa', 1, type=int)
        limit = 10
        offset = (sayfa - 1) * limit

        response = supabase_client.table('yem_islemleri') \
            .select('islem_tarihi, miktar_kg, toplam_tutar, yem_urunleri(yem_adi)', count='exact') \
            .eq('tedarikci_id', tedarikci_id) \
            .order('islem_tarihi', desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()

        return jsonify({"data": response.data, "count": response.count})
        
    except Exception as e:
        logger.error(f"Çiftçi yem işlemleri (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Yem işlemleri alınırken bir hata oluştu."}), 500