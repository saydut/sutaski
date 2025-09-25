# blueprints/yem.py
from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase
from datetime import datetime
from decimal import Decimal # BU SATIR EKLENDİ

# Yem blueprint'ini oluşturuyoruz.
yem_bp = Blueprint('yem', __name__, url_prefix='/yem')

# --- ARAYÜZ SAYFALARI ---

@yem_bp.route('/yonetim')
@login_required
@lisans_kontrolu
def yem_yonetimi_sayfasi():
    """Yem yönetimi ana sayfasını render eder."""
    return render_template('yem_yonetimi.html')

# --- API UÇ NOKTALARI ---

# Yem Ürünleri API'leri
@yem_bp.route('/api/urunler', methods=['GET'])
@login_required
def get_yem_urunleri():
    """Şirkete ait tüm yem ürünlerini listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        urunler = supabase.table('yem_urunleri').select('*').eq('sirket_id', sirket_id).order('yem_adi').execute()
        return jsonify(urunler.data)
    except Exception as e:
        print(f"Yem ürünleri listeleme hatası: {e}")
        return jsonify({"error": "Ürünler listelenirken bir sunucu hatası oluştu."}), 500

@yem_bp.route('/api/urunler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_urunu():
    """Yeni bir yem ürünü ekler."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        
        # Gelen verilerin doğruluğunu kontrol et
        yem_adi = data.get('yem_adi')
        stok = data.get('stok_miktari_kg')
        fiyat = data.get('birim_fiyat')

        if not yem_adi or not stok or not fiyat:
            return jsonify({"error": "Lütfen tüm alanları doldurun."}), 400

        yeni_urun = {
            "sirket_id": sirket_id,
            "yem_adi": yem_adi,
            "stok_miktari_kg": Decimal(stok),
            "birim_fiyat": Decimal(fiyat)
        }
        result = supabase.table('yem_urunleri').insert(yeni_urun).execute()
        return jsonify(result.data[0]), 201
    except Exception as e:
        print(f"Yem ürünü ekleme hatası: {e}")
        return jsonify({"error": "Ürün eklenirken bir sunucu hatası oluştu."}), 500

# Yem İşlemleri API'leri
@yem_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_yem_islemi():
    """Yeni bir yem çıkış işlemi kaydeder ve stoku günceller."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']
        
        yem_urun_id = data.get('yem_urun_id')
        tedarikci_id = data.get('tedarikci_id')
        
        # Gelen miktarı Decimal'e çeviriyoruz
        try:
            miktar_kg = Decimal(data.get('miktar_kg'))
            if miktar_kg <= 0:
                return jsonify({"error": "Miktar pozitif bir değer olmalıdır."}), 400
        except:
             return jsonify({"error": "Geçersiz miktar formatı."}), 400

        if not yem_urun_id or not tedarikci_id:
             return jsonify({"error": "Tedarikçi ve yem ürünü seçimi zorunludur."}), 400

        # 1. Yem ürününün güncel bilgilerini veritabanından al
        urun_res = supabase.table('yem_urunleri').select('stok_miktari_kg, birim_fiyat').eq('id', yem_urun_id).eq('sirket_id', sirket_id).single().execute()
        if not urun_res.data:
            return jsonify({"error": "Yem ürünü bulunamadı."}), 404
            
        mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
        birim_fiyat = Decimal(urun_res.data['birim_fiyat'])

        # 2. Stok kontrolü yap
        if mevcut_stok < miktar_kg:
            return jsonify({"error": f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg"}), 400

        # 3. Yem işlemi kaydını oluştur
        toplam_tutar = miktar_kg * birim_fiyat
        yeni_islem = {
            "sirket_id": sirket_id,
            "tedarikci_id": tedarikci_id,
            "yem_urun_id": yem_urun_id,
            "kullanici_id": kullanici_id,
            "miktar_kg": miktar_kg,
            "islem_anindaki_birim_fiyat": birim_fiyat,
            "toplam_tutar": toplam_tutar,
            "aciklama": data.get('aciklama')
        }
        result = supabase.table('yem_islemleri').insert(yeni_islem).execute()

        # 4. Stoktan düş
        yeni_stok = mevcut_stok - miktar_kg
        supabase.table('yem_urunleri').update({"stok_miktari_kg": yeni_stok}).eq('id', yem_urun_id).execute()

        return jsonify(result.data[0]), 201

    except Exception as e:
        print(f"Yem işlemi hatası: {e}")
        return jsonify({"error": "İşlem sırasında bir hata oluştu."}), 500

