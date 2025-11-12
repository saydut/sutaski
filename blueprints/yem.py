from flask import Blueprint, render_template, request, jsonify, g, current_app
from decorators import login_required, role_required
from services.yem_service import YemService
from utils import parse_int_or_none, parse_decimal_or_none, parse_date_or_none

yem_bp = Blueprint('yem', __name__)
yem_service = YemService()

# --- 1. HTML Sayfa Rotası ---

@yem_bp.route('/')
@login_required
@role_required('firma_admin', 'firma_calisan')
def yem_yonetimi_sayfasi():
    """Yem yönetimi (işlemler) listeleme sayfasını render eder."""
    return render_template('yem_yonetimi.html')


# --- 2. API ROTALARI ---

@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan', 'toplayici')
def get_yem_urunleri_dropdown():
    """
    Hızlı İşlem (Yem) modalındaki 'Yem Tipi' dropdown'unu doldurur.
    """
    try:
        sirket_id = g.user.sirket_id
        urunler, error = yem_service.get_yem_urunleri(sirket_id)
        if error:
            return jsonify(hata=error), 500
        return jsonify(urunler), 200
    except Exception as e:
        current_app.logger.error(f"Yem ürünleri dropdown hatası: {e}", exc_info=True)
        return jsonify(hata=f"Yem ürünleri listesi alınamadı: {str(e)}"), 500


@yem_bp.route('/api/ekle', methods=['POST'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def yem_ekle():
    """
    Hızlı İşlem modalından yeni yem işlemi (satış/dağıtım) ekler.
    """
    try:
        data = request.json
        sirket_id = g.user.sirket_id
        kullanici_id = g.user.id # UUID
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        yem_urun_id = parse_int_or_none(data.get('yem_urun_id'))
        miktar = parse_decimal_or_none(data.get('miktar'))
        birim_fiyat = parse_decimal_or_none(data.get('birim_fiyat'))
        
        if not all([tedarikci_id, yem_urun_id, miktar, birim_fiyat]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi, Yem Tipi, Miktar ve Birim Fiyat zorunludur."), 400
        
        # Opsiyonel alanlar
        islem_tarihi_str = data.get('islem_tarihi')
        
        yeni_islem, error = yem_service.create_yem_islemi(
            sirket_id=sirket_id,
            kullanici_id=kullanici_id,
            tedarikci_id=tedarikci_id,
            yem_urun_id=yem_urun_id,
            miktar=miktar,
            birim_fiyat=birim_fiyat,
            islem_tarihi_str=islem_tarihi_str
        )
        
        if error:
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Yem işlemi başarıyla eklendi.", islem=yeni_islem), 201

    except Exception as e:
        current_app.logger.error(f"Yem ekleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Yem işlemi eklenemedi: {str(e)}"), 500


@yem_bp.route('/api/listele', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def yem_listele():
    """
    Yem yönetimi sayfası için işlemleri listeler.
    """
    try:
        sirket_id = g.user.sirket_id
        
        # Filtreleme parametreleri
        sayfa = parse_int_or_none(request.args.get('sayfa')) or 1
        limit = parse_int_or_none(request.args.get('limit')) or 10
        tedarikci_id = parse_int_or_none(request.args.get('tedarikci_id'))
        yem_urun_id = parse_int_or_none(request.args.get('yem_urun_id'))
        baslangic_tarihi = parse_date_or_none(request.args.get('baslangic_tarihi'))
        bitis_tarihi = parse_date_or_none(request.args.get('bitis_tarihi'))

        data, count, error = yem_service.get_yem_islemleri_paginated(
            sirket_id=sirket_id,
            sayfa=sayfa,
            limit=limit,
            tedarikci_id=tedarikci_id,
            yem_urun_id=yem_urun_id,
            baslangic_tarihi=baslangic_tarihi,
            bitis_tarihi=bitis_tarihi
        )
        
        if error:
            return jsonify(hata=error), 500

        return jsonify({
            'islemler': data,
            'toplam_kayit': count,
            'sayfa': sayfa
        }), 200

    except Exception as e:
        current_app.logger.error(f"Yem listeleme hatası: {e}", exc_info=True)
        return jsonify(hata=f"Yem işlemleri listelenemedi: {str(e)}"), 500


@yem_bp.route('/api/<int:islem_id>/sil', methods=['DELETE'])
@login_required
@role_required('firma_admin') # Sadece admin silebilir
def yem_sil(islem_id):
    """
    Bir yem işlemini siler. (RLS kontrolü devrede)
    """
    try:
        success, error = yem_service.delete_yem_islemi(islem_id)
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Yem işlemi başarıyla silindi."), 200

    except Exception as e:
        current_app.logger.error(f"Yem silme hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"Yem işlemi silinemedi: {str(e)}"), 500


@yem_bp.route('/api/<int:islem_id>/detay', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def get_yem_detay(islem_id):
    """
    Bir yem işleminin detayını (düzenleme modalı için) getirir.
    """
    try:
        data, error = yem_service.get_yem_islemi_by_id(islem_id)
        
        if error:
             return jsonify(hata=error), 404
        
        return jsonify(data), 200

    except Exception as e:
        current_app.logger.error(f"Yem detay hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"İşlem detayı alınamadı: {str(e)}"), 500


@yem_bp.route('/api/<int:islem_id>/guncelle', methods=['PUT'])
@login_required
@role_required('firma_admin') # Sadece admin güncelleyebilir
def yem_guncelle(islem_id):
    """
    Bir yem işlemini günceller (Modal'dan).
    """
    try:
        data = request.json
        
        # Gerekli alanların kontrolü
        tedarikci_id = parse_int_or_none(data.get('tedarikci_id'))
        yem_urun_id = parse_int_or_none(data.get('yem_urun_id'))
        miktar = parse_decimal_or_none(data.get('miktar'))
        birim_fiyat = parse_decimal_or_none(data.get('birim_fiyat'))
        
        if not all([tedarikci_id, yem_urun_id, miktar, birim_fiyat]):
            return jsonify(hata="Eksik veya geçersiz veri: Tedarikçi, Yem Tipi, Miktar ve Birim Fiyat zorunludur."), 400

        # Opsiyonel alanlar
        islem_tarihi_str = data.get('islem_tarihi')

        guncellenen_islem, error = yem_service.update_yem_islemi(
            islem_id=islem_id,
            tedarikci_id=tedarikci_id,
            yem_urun_id=yem_urun_id,
            miktar=miktar,
            birim_fiyat=birim_fiyat,
            islem_tarihi_str=islem_tarihi_str
        )
        
        if error:
            if "bulunamadı" in error or "yetkiniz yok" in error:
                return jsonify(hata=error), 404
            return jsonify(hata=error), 500
            
        return jsonify(mesaj="Yem işlemi başarıyla güncellendi.", islem=guncellenen_islem), 200

    except Exception as e:
        current_app.logger.error(f"Yem güncelleme hatası (ID: {islem_id}): {e}", exc_info=True)
        return jsonify(hata=f"Yem işlemi güncellenemedi: {str(e)}"), 500

# --- HATA ÇIKIŞI YAPAN KOD ---
# Çift tanımlandığı için çakışmaya neden olan 'decorator' fonksiyonu kaldırıldı.