from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase
from datetime import datetime
from decimal import Decimal, InvalidOperation
import traceback

finans_bp = Blueprint('finans', __name__, url_prefix='/finans')

# --- ARAYÜZ SAYFALARI ---
@finans_bp.route('/')
@login_required
@lisans_kontrolu
def finans_sayfasi():
    """Finansal işlemlerin listelendiği ana sayfa."""
    return render_template('finans_yonetimi.html')

# --- API UÇ NOKTALARI ---

@finans_bp.route('/api/islemler', methods=['GET'])
@login_required
def get_finansal_islemler():
    """Şirkete ait tüm finansal işlemleri listeler."""
    try:
        sirket_id = session['user']['sirket_id']
        islemler = supabase.table('finansal_islemler').select(
            '*, tedarikciler(isim)'
        ).eq('sirket_id', sirket_id).order('islem_tarihi', desc=True).execute()
        return jsonify(islemler.data)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "İşlemler listelenirken bir sunucu hatası oluştu."}), 500


@finans_bp.route('/api/islemler', methods=['POST'])
@login_required
@modification_allowed
def add_finansal_islem():
    """Yeni bir avans veya ödeme işlemi ekler."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        kullanici_id = session['user']['id']

        islem_tipi = data.get('islem_tipi')
        tedarikci_id = data.get('tedarikci_id')
        tutar = data.get('tutar')
        
        if not all([islem_tipi, tedarikci_id, tutar]):
            return jsonify({"error": "Lütfen tüm zorunlu alanları doldurun."}), 400
        
        if islem_tipi not in ['Ödeme', 'Avans']:
            return jsonify({"error": "Geçersiz işlem tipi."}), 400

        try:
            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                return jsonify({"error": "Tutar pozitif bir değer olmalıdır."}), 400
        except (InvalidOperation, TypeError):
            return jsonify({"error": "Lütfen tutar için geçerli bir sayı girin."}), 400

        yeni_islem = {
            "sirket_id": sirket_id,
            "tedarikci_id": tedarikci_id,
            "kullanici_id": kullanici_id,
            "islem_tipi": islem_tipi,
            "tutar": str(tutar_decimal),
            "aciklama": data.get('aciklama') or None,
            "islem_tarihi": data.get('islem_tarihi')
        }
        
        if not yeni_islem["islem_tarihi"]:
            del yeni_islem["islem_tarihi"]

        supabase.table('finansal_islemler').insert(yeni_islem).execute()
        
        return jsonify({"message": f"{islem_tipi} işlemi başarıyla kaydedildi."}), 201

    except Exception:
        traceback.print_exc()
        return jsonify({"error": "İşlem sırasında bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['PUT'])
@login_required
@modification_allowed
def update_finansal_islem(islem_id):
    """Mevcut bir finansal işlemi günceller."""
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']

        islem = supabase.table('finansal_islemler').select('id').eq('id', islem_id).eq('sirket_id', sirket_id).single().execute()
        if not islem.data:
            return jsonify({"error": "İşlem bulunamadı veya yetkiniz yok."}), 404
        
        guncellenecek_veri = {}
        if 'tutar' in data:
            try:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0: return jsonify({"error": "Tutar pozitif olmalıdır."}), 400
                guncellenecek_veri['tutar'] = str(tutar_decimal)
            except (InvalidOperation, TypeError):
                return jsonify({"error": "Geçerli bir tutar girin."}), 400

        if 'aciklama' in data:
            guncellenecek_veri['aciklama'] = data['aciklama'].strip() or None

        if not guncellenecek_veri:
            return jsonify({"error": "Güncellenecek veri bulunamadı."}), 400

        supabase.table('finansal_islemler').update(guncellenecek_veri).eq('id', islem_id).execute()
        return jsonify({"message": "İşlem başarıyla güncellendi."})

    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Güncelleme sırasında bir sunucu hatası oluştu."}), 500

@finans_bp.route('/api/islemler/<int:islem_id>', methods=['DELETE'])
@login_required
@modification_allowed
def delete_finansal_islem(islem_id):
    """Bir finansal işlemi siler."""
    try:
        sirket_id = session['user']['sirket_id']
        islem = supabase.table('finansal_islemler').select('id').eq('id', islem_id).eq('sirket_id', sirket_id).single().execute()
        if not islem.data:
            return jsonify({"error": "İşlem bulunamadı veya yetkiniz yok."}), 404

        supabase.table('finansal_islemler').delete().eq('id', islem_id).execute()
        return jsonify({"message": "İşlem başarıyla silindi."})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Silme işlemi sırasında bir hata oluştu."}), 500
