from flask import Blueprint, jsonify, request
from extensions import supabase
from decorators import login_required, admin_required

versioning_bp = Blueprint('versioning', __name__, url_prefix='/api/versioning')

# --- SÜRÜM YÖNETİMİ API'LARI ---

@versioning_bp.route('/surum_notlari', methods=['GET'])
@login_required
@admin_required
def get_surum_notlari():
    """Tüm sürüm notlarını veritabanından çeker."""
    try:
        notlar = supabase.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()
        return jsonify(notlar.data)
    except Exception as e:
        print(f"Sürüm notları alınırken hata: {e}")
        return jsonify({"error": "Sürüm notları alınamadı."}), 500

@versioning_bp.route('/surum_notlari', methods=['POST'])
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

@versioning_bp.route('/surum_notlari/<int:id>', methods=['PUT'])
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

@versioning_bp.route('/surum_notlari/<int:id>', methods=['DELETE'])
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