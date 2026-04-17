import pandas as pd
import re

# Mapping des noms vers IDs
REDacteur_IDS = {
    'Outhman BOUDARRAJA': 'user001',
    'ASMAA': 'user002',
    'KARIM': 'user008',
    'Soukaina HAJJAMI': 'user007',
    'Loubna BENKADDOUSS': 'user006'
}

TECHSON_IDS = {
    'Driss BAKKARI': 'user003',
    'Hassan LABHAR': 'user011',
    'Hassnaa TALAI': 'user010'
}

def extract_materialRef(name):
    """Extrait le materialRef du nom du projet"""
    if not name or pd.isna(name):
        return None
    name_str = str(name)
    pattern = r'[_-]([mgeit]\d+[a]?)_?\d{4}-\d{1,2}-\d{1,2}'
    match = re.search(pattern, name_str)
    if match:
        return match.group(1)
    return None

def extract_seriesName(name):
    """Extrait le nom de la série depuis le nom complet"""
    if not name or pd.isna(name):
        return ''
    name_str = str(name)
    match = re.match(r'^([a-zA-Z0-9]+)-', name_str)
    if match:
        return match.group(1)
    return name_str[:50]

def determine_projectType(name):
    """Détermine le type de projet"""
    if not name or pd.isna(name):
        return 'SERIE_EMISSION'
    name_str = str(name)
    film_pattern = r'-0_[mgei]\d+[a]?'
    serie_pattern = r'-\d+_\d+-[mgei]\d+[a]?'
    if re.search(film_pattern, name_str):
        return 'FILM'
    elif re.search(serie_pattern, name_str):
        return 'SERIE_EMISSION'
    else:
        return 'SERIE_EMISSION'

def convert_to_int(value):
    """Convertit en integer pur"""
    if pd.isna(value) or value == '' or value is None:
        return ''
    try:
        return int(float(value))
    except:
        return ''

def convert_to_float(value):
    """Convertit en float"""
    if pd.isna(value) or value == '' or value is None:
        return ''
    try:
        return float(value)
    except:
        return ''

def format_date(value):
    """Formate une date en YYYY-MM-DD"""
    if pd.isna(value) or value == '' or value is None:
        return ''
    try:
        if isinstance(value, pd.Timestamp):
            return value.strftime('%Y-%m-%d')
        date_str = str(value)
        if date_str == '00/01/1900':
            return ''
        for fmt in ['%m/%d/%y', '%Y-%m-%d', '%d/%m/%Y']:
            try:
                return pd.to_datetime(date_str, format=fmt).strftime('%Y-%m-%d')
            except:
                continue
        return date_str
    except:
        return ''

def format_datetime(value):
    """Formate un datetime"""
    if pd.isna(value) or value == '' or value is None:
        return ''
    try:
        if isinstance(value, pd.Timestamp):
            return value.strftime('%Y-%m-%d %H:%M:%S')
        return str(value)
    except:
        return ''

def normalize_status(value):
    """Normalise les statuts"""
    if pd.isna(value) or value == '':
        return 'PAS_ENCORE'
    value_str = str(value).upper().strip()
    if 'FAIT' in value_str or 'FAI' in value_str:
        return 'FAIT'
    elif 'EN_COURS' in value_str or 'EN COURS' in value_str:
        return 'EN_COURS'
    elif 'PAS_ENCORE' in value_str or 'PAS ENCORE' in value_str:
        return 'PAS_ENCORE'
    elif 'SIGNALE' in value_str:
        return 'SIGNALE'
    else:
        return 'PAS_ENCORE'

# Lire le fichier Excel
print("📖 Lecture du fichier Excel...")
df = pd.read_excel('Nouveau Feuille de calcul Microsoft Excel.xlsx')

print(f"📊 Total lignes: {len(df)}")

# Nettoyer les noms de colonnes
df.columns = df.columns.str.strip().str.lower()
print("\n📋 Colonnes trouvées dans Excel:")
print(list(df.columns))

# Ajouter les IDs
print("\n🔗 Conversion des noms en IDs...")
df['redacteur_id'] = df['redacteur'].map(REDacteur_IDS)
df['tech_son_id'] = df['tech son'].map(TECHSON_IDS)

# Extraire materialRef et seriesName
print("🔍 Extraction des materialRef et seriesName...")
df['material_ref'] = df['nom du projet'].apply(extract_materialRef)
df['series_name'] = df['nom du projet'].apply(extract_seriesName)

# Déterminer le type de projet
print("🎬 Détermination des types de projets...")
df['project_type'] = df['nom du projet'].apply(determine_projectType)

# Normaliser les statuts
print("📝 Normalisation des statuts...")
df['mix_status'] = df['statut mixage'].apply(normalize_status)
df['status'] = df['statut redaction'].apply(normalize_status)
df['vs_status'] = df['narration/vs'].apply(normalize_status)

# Convertir les nombres
print("🔢 Conversion des nombres...")
df['page_count'] = df['nbr de pages'].apply(convert_to_int)
df['duration_min'] = df['durée minutes'].apply(convert_to_float)

# Formater les dates
print("📅 Formatage des dates...")
df['start_date'] = df['date de reception'].apply(format_date)
df['deadline'] = df["date d'echeance"].apply(format_date)
df['written_at'] = df['date de rédaction'].apply(format_date)
df['mixed_at'] = df['date de narration et /mixage.'].apply(format_date)
df['delivered_at'] = df['date de livraison'].apply(format_datetime)

# Créer le DataFrame final
print("\n📦 Création du DataFrame final...")
final_df = pd.DataFrame()

column_mapping = {
    'nom du projet': 'name',
    'series_name': 'seriesName',  # ← ← ← AJOUTÉ
    'material_ref': 'materialRef',
    'project_type': 'projectType',
    'start_date': 'startDate',
    'deadline': 'deadline',
    'mix_status': 'mixStatus',
    'page_count': 'pageCount',
    'written_at': 'writtenAt',
    'status': 'status',
    'mixed_at': 'mixedAt',
    'redacteur_id': 'redacteurId',
    'vs_status': 'vsStatus',
    'tech_son_id': 'techSonId',
    'livraison': 'deliveryStatus',
    'delivered_at': 'deliveredAt',
    'duration_min': 'durationMin',
    'chaine': 'broadcastChannel'
}

for excel_col, db_col in column_mapping.items():
    if excel_col in df.columns:
        final_df[db_col] = df[excel_col]
    else:
        print(f"⚠️  Colonne Excel manquante: {excel_col}")
        final_df[db_col] = ''

# Sauvegarder en CSV
final_df.to_csv('projects_import.csv', index=False, sep=',', encoding='utf-8-sig')

print("\n✅ Fichier CSV généré avec succès !")
print(f"📊 Total projets: {len(final_df)}")
print(f"🎬 FILM: {len(final_df[final_df['projectType'] == 'FILM'])}")
print(f"📺 SERIE_EMISSION: {len(final_df[final_df['projectType'] == 'SERIE_EMISSION'])}")

# Vérifications
print("\n⚠️  Vérifie les seriesName NULL:")
null_series = final_df[final_df['seriesName'].isnull() | (final_df['seriesName'] == '')]
if len(null_series) > 0:
    print(f"Nombre de projets sans seriesName: {len(null_series)}")
    print(null_series[['name', 'seriesName']].head(10))
else:
    print("✅ Tous les seriesName sont extraits !")

print("\n📋 Colonnes du CSV final:")
print(list(final_df.columns))

print("\n📁 Fichier créé: projects_import.csv")