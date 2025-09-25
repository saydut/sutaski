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
            "islem_tarihi": data.get('islem_tarihi') # Eğer boşsa Supabase'deki default değeri kullanır
        }
        
        # islem_tarihi boşsa dict'ten kaldır
        if not yeni_islem["islem_tarihi"]:
            del yeni_islem["islem_tarihi"]

        supabase.table('finansal_islemler').insert(yeni_islem).execute()
        
        return jsonify({"message": f"{islem_tipi} işlemi başarıyla kaydedildi."}), 201

    except Exception:
        traceback.print_exc()
        return jsonify({"error": "İşlem sırasında bir sunucu hatası oluştu."}), 500
