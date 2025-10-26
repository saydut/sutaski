# blueprints/ciftci.py

import logging
from flask import Blueprint, jsonify, request, session, g
from decorators import login_required # Genel giriş kontrolü
from constants import UserRole # Rolleri kontrol etmek için
from decimal import Decimal

logger = logging.getLogger(__name__)
ciftci_bp = Blueprint('ciftci', __name__, url_prefix='/api/ciftci')

# --- Yardımcı Fonksiyon: Giriş yapmış çiftçinin tedarikçi ID'sini bul ---
def _get_ciftci_tedarikci_id():
    """
    Session'daki kullanıcı ID'sini kullanarak ilgili tedarikçi ID'sini bulur.
    Kullanıcı çiftçi değilse veya tedarikçi ile eşleşmiyorsa None döner.
    """
    user_info = session.get('user')
    if not user_info or user_info.get('rol') != UserRole.CIFCI.value:
        return None # Yetkisiz veya çiftçi değil

    user_id = user_info['id']
    sirket_id = user_info['sirket_id']

    # Tedarikçiler tablosundan bu kullanıcı ID'sine bağlı tedarikçiyi bul
    tedarikci_res = g.supabase.table('tedarikciler') \
        .select('id') \
        .eq('kullanici_id', user_id) \
        .eq('sirket_id', sirket_id) \
        .maybe_single() \
        .execute()

    if tedarikci_res.data:
        return tedarikci_res.data['id']
    else:
        logger.warning(f"Çiftçi rolündeki kullanıcı {user_id} için eşleşen tedarikçi kaydı bulunamadı (Şirket ID: {sirket_id}).")
        return None # Eşleşen tedarikçi yok

# --- API Endpoint'leri ---

@ciftci_bp.route('/ozet', methods=['GET'])
@login_required # Önce giriş yapılmış mı kontrol et
def get_ciftci_ozet():
    """Giriş yapmış çiftçinin finansal özetini getirir."""
    tedarikci_id = _get_ciftci_tedarikci_id()
    if tedarikci_id is None:
        # Hata _get_ciftci_tedarikci_id içinde loglandı, burada sadece yetkisiz mesajı dönüyoruz
        return jsonify({"error": "Bu bilgilere erişim yetkiniz yok veya profilinizle eşleşen bir tedarikçi kaydı bulunamadı."}), 403

    sirket_id = session['user']['sirket_id']

    try:
        # Tedarikçi özeti için RPC fonksiyonunu kullanalım (bu fonksiyon zaten vardı)
        summary_res = g.supabase.rpc('get_supplier_summary', {
            'p_sirket_id': sirket_id,
            'p_tedarikci_id': tedarikci_id
        }).execute()

        if not summary_res.data:
             # RPC hata döndürürse veya veri bulamazsa
             return jsonify({
                "toplam_sut_alacagi": "0.00",
                "toplam_yem_borcu": "0.00",
                "toplam_odeme": "0.00",
                "net_bakiye": "0.00"
            })

        ozet = summary_res.data
        # Sayıları string olarak formatlayıp gönderelim (Decimal->JSON sorunları yaşamamak için)
        formatted_ozet = {
            "toplam_sut_alacagi": f"{Decimal(ozet.get('toplam_sut_alacagi', 0)):.2f}",
            "toplam_yem_borcu": f"{Decimal(ozet.get('toplam_yem_borcu', 0)):.2f}",
            "toplam_odeme": f"{Decimal(ozet.get('toplam_odeme', 0)):.2f}",
            "net_bakiye": f"{Decimal(ozet.get('net_bakiye', 0)):.2f}"
        }
        return jsonify(formatted_ozet)

    except Exception as e:
        logger.error(f"Çiftçi özeti alınırken hata (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify({"error": "Özet bilgileri alınırken bir sunucu hatası oluştu."}), 500


@ciftci_bp.route('/sut_girdileri', methods=['GET'])
@login_required
def get_ciftci_sut_girdileri():
    """Giriş yapmış çiftçinin süt girdilerini sayfalayarak getirir."""
    tedarikci_id = _get_ciftci_tedarikci_id()
    if tedarikci_id is None:
        return jsonify({"error": "Bu bilgilere erişim yetkiniz yok veya profilinizle eşleşen bir tedarikçi kaydı bulunamadı."}), 403

    sirket_id = session['user']['sirket_id']
    sayfa = int(request.args.get('sayfa', 1))
    limit = int(request.args.get('limit', 10)) # Sayfa başına kayıt sayısı
    offset = (sayfa - 1) * limit

    try:
        # Sadece ilgili tedarikçinin süt girdilerini çek
        query = g.supabase.table('sut_girdileri').select(
            'id, taplanma_tarihi, litre, fiyat', # Sadece çiftçinin görmesi gereken alanlar
            count='exact' # Toplam kayıt sayısı için
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id) \
         .order('taplanma_tarihi', desc=True) \
         .range(offset, offset + limit - 1)

        response = query.execute()

        # Litre ve Fiyat'ı ondalık sayıya çevirip tutarı hesapla
        girdiler = []
        for girdi in response.data:
            litre = Decimal(girdi.get('litre', '0'))
            fiyat = Decimal(girdi.get('fiyat', '0'))
            girdiler.append({
                "id": girdi['id'],
                "tarih": girdi['taplanma_tarihi'], # Frontend'de formatlanabilir
                "litre": f"{litre:.2f}",
                "fiyat": f"{fiyat:.2f}",
                "tutar": f"{(litre * fiyat):.2f}"
            })

        return jsonify({"girdiler": girdiler, "toplam_kayit": response.count})

    except Exception as e:
        logger.error(f"Çiftçi süt girdileri alınırken hata (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify({"error": "Süt girdileri alınırken bir sunucu hatası oluştu."}), 500


@ciftci_bp.route('/yem_alimlarim', methods=['GET'])
@login_required
def get_ciftci_yem_alimlarim():
    """Giriş yapmış çiftçinin yem alımlarını sayfalayarak getirir."""
    tedarikci_id = _get_ciftci_tedarikci_id()
    if tedarikci_id is None:
        return jsonify({"error": "Bu bilgilere erişim yetkiniz yok veya profilinizle eşleşen bir tedarikçi kaydı bulunamadı."}), 403

    sirket_id = session['user']['sirket_id']
    sayfa = int(request.args.get('sayfa', 1))
    limit = int(request.args.get('limit', 10))
    offset = (sayfa - 1) * limit

    try:
        # Sadece ilgili tedarikçinin yem işlemlerini çek
        query = g.supabase.table('yem_islemleri').select(
            'id, islem_tarihi, miktar_kg, islem_anindaki_birim_fiyat, toplam_tutar, yem_urunleri(yem_adi)', # Yem adını da alalım
            count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id) \
         .order('islem_tarihi', desc=True) \
         .range(offset, offset + limit - 1)

        response = query.execute()

        # Veriyi formatlayarak döndür
        islemler = []
        for islem in response.data:
            islemler.append({
                "id": islem['id'],
                "tarih": islem['islem_tarihi'],
                "yem_adi": islem['yem_urunleri']['yem_adi'] if islem.get('yem_urunleri') else 'Bilinmeyen Yem',
                "miktar_kg": f"{Decimal(islem.get('miktar_kg','0')):.2f}",
                "birim_fiyat": f"{Decimal(islem.get('islem_anindaki_birim_fiyat','0')):.2f}",
                "toplam_tutar": f"{Decimal(islem.get('toplam_tutar','0')):.2f}"
            })

        return jsonify({"islemler": islemler, "toplam_kayit": response.count})

    except Exception as e:
        logger.error(f"Çiftçi yem alımları alınırken hata (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
        return jsonify({"error": "Yem alımları alınırken bir sunucu hatası oluştu."}), 500