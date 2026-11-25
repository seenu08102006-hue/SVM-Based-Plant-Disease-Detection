"""Agronomy knowledge base: description / prevention / treatment per disease.

Keys are the folder names of the PlantVillage dataset. `build_mapping()` merges this with the
classes that were actually discovered in the dataset (any class missing here gets a generic entry,
so adding new folders to the dataset never breaks training).

This is general educational guidance, not a substitute for a local agronomist.
"""
from __future__ import annotations

import re

# (description, [prevention...], [treatment...])
DISEASES: dict[str, tuple[str, list[str], list[str]]] = {
    "Apple___Apple_scab": (
        "Fungal disease (Venturia inaequalis) causing olive-green to brown velvety spots on leaves and scabby lesions on fruit.",
        ["Rake and destroy fallen leaves in autumn", "Prune for open canopy and air flow", "Plant scab-resistant cultivars"],
        ["Apply protectant fungicide (captan, mancozeb or sulfur) from green tip", "Use systemic fungicide (myclobutanil) during wet spring weather"]),
    "Apple___Black_rot": (
        "Fungal disease (Botryosphaeria obtusa) producing purple-ringed 'frog-eye' leaf spots, fruit rot and cankers.",
        ["Prune out dead wood and cankers", "Remove mummified fruit", "Keep trees well watered and fertilised to avoid stress"],
        ["Cut out cankers during dry weather", "Apply captan or thiophanate-methyl fungicide from petal fall"]),
    "Apple___Cedar_apple_rust": (
        "Fungal disease (Gymnosporangium juniperi-virginianae) with bright yellow-orange leaf spots; needs juniper/cedar as an alternate host.",
        ["Remove nearby juniper or cedar galls", "Plant rust-resistant apple varieties", "Ensure good air circulation"],
        ["Spray myclobutanil or mancozeb from pink bud through petal fall", "Remove heavily infected leaves"]),
    "Apple___healthy": ("No disease symptoms detected. The apple leaf appears healthy.",
        ["Maintain annual pruning", "Monitor regularly for scab and rust", "Balanced fertilisation and irrigation"], ["No treatment required"]),
    "Blueberry___healthy": ("No disease symptoms detected. The blueberry leaf appears healthy.",
        ["Keep soil pH between 4.5 and 5.5", "Mulch to retain moisture", "Prune old canes for airflow"], ["No treatment required"]),
    "Cherry_(including_sour)___Powdery_mildew": (
        "Fungal disease (Podosphaera clandestina) forming white powdery growth on leaves and young shoots, causing curling and reduced vigour.",
        ["Prune for airflow and sunlight penetration", "Avoid excessive nitrogen", "Water at the base, not overhead"],
        ["Apply sulfur, potassium bicarbonate or myclobutanil at first sign", "Remove and destroy infected shoots"]),
    "Cherry_(including_sour)___healthy": ("No disease symptoms detected. The cherry leaf appears healthy.",
        ["Prune in dry weather", "Keep orchard floor clean of debris", "Scout regularly for mildew"], ["No treatment required"]),
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": (
        "Fungal disease (Cercospora zeae-maydis) causing long, rectangular, tan-to-grey lesions parallel to leaf veins.",
        ["Rotate crops (avoid corn after corn)", "Till residue under to reduce inoculum", "Choose tolerant hybrids"],
        ["Apply strobilurin or triazole fungicide at tasseling (VT/R1) if pressure is high"]),
    "Corn_(maize)___Common_rust_": (
        "Fungal disease (Puccinia sorghi) producing small, powdery, cinnamon-brown pustules on both leaf surfaces.",
        ["Plant resistant hybrids", "Plant early to avoid cool, humid late-season spread", "Scout from mid-season"],
        ["Apply foliar fungicide (azoxystrobin, propiconazole) if pustules appear before tasseling on susceptible hybrids"]),
    "Corn_(maize)___Northern_Leaf_Blight": (
        "Fungal disease (Exserohilum turcicum) causing long, cigar-shaped grey-green to tan lesions that can destroy leaf area.",
        ["Use resistant hybrids", "Rotate with non-host crops", "Bury infected residue"],
        ["Apply foliar fungicide at early disease onset (VT-R2)", "Avoid overhead irrigation late in the day"]),
    "Corn_(maize)___healthy": ("No disease symptoms detected. The maize leaf appears healthy.",
        ["Rotate crops", "Maintain balanced fertility", "Scout fields weekly"], ["No treatment required"]),
    "Grape___Black_rot": (
        "Fungal disease (Guignardia bidwellii) causing brown circular leaf lesions with dark borders and shrivelled black 'mummy' berries.",
        ["Remove mummified berries and infected canes", "Open the canopy through training and pruning", "Control weeds under vines"],
        ["Apply mancozeb, myclobutanil or captan from early shoot growth until fruit set"]),
    "Grape___Esca_(Black_Measles)": (
        "Complex fungal trunk disease causing 'tiger-stripe' interveinal leaf discolouration and spotted berries; can kill vines.",
        ["Protect pruning wounds with sealant", "Prune in dry weather", "Disinfect pruning tools"],
        ["No fully effective cure: remove and burn affected wood", "Trunk surgery on valuable vines; replace severely affected vines"]),
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": (
        "Fungal leaf spot (Pseudocercospora vitis) with irregular dark brown lesions, leading to early defoliation.",
        ["Improve canopy ventilation", "Clear fallen leaves", "Avoid overhead irrigation"],
        ["Apply copper-based or mancozeb fungicide", "Remove severely infected leaves"]),
    "Grape___healthy": ("No disease symptoms detected. The grape leaf appears healthy.",
        ["Prune and train for airflow", "Monitor for mildew and rot", "Sanitise tools"], ["No treatment required"]),
    "Orange___Haunglongbing_(Citrus_greening)": (
        "Devastating bacterial disease (Candidatus Liberibacter) spread by the Asian citrus psyllid; causes blotchy yellow leaves, lopsided bitter fruit and tree decline.",
        ["Control psyllid vectors with insecticide and biological control", "Plant certified disease-free nursery stock", "Scout regularly and report suspect trees"],
        ["There is no cure: remove and destroy infected trees to protect the grove", "Nutritional programmes can prolong productivity of infected trees"]),
    "Peach___Bacterial_spot": (
        "Bacterial disease (Xanthomonas arboricola pv. pruni) causing small angular water-soaked leaf spots that drop out ('shot-hole') and pitted fruit.",
        ["Plant tolerant varieties", "Avoid overhead irrigation", "Use windbreaks and avoid excess nitrogen"],
        ["Apply copper bactericide in early season", "Oxytetracycline sprays where registered"]),
    "Peach___healthy": ("No disease symptoms detected. The peach leaf appears healthy.",
        ["Prune for open centre", "Clean up fallen fruit and leaves", "Monitor for leaf curl and bacterial spot"], ["No treatment required"]),
    "Pepper,_bell___Bacterial_spot": (
        "Bacterial disease (Xanthomonas spp.) causing small, dark, water-soaked leaf spots and raised scabby fruit lesions.",
        ["Use certified disease-free seed or transplants", "Rotate with non-solanaceous crops for 2-3 years", "Avoid working in wet fields"],
        ["Apply copper plus mancozeb sprays at first symptoms", "Remove and destroy heavily infected plants"]),
    "Pepper,_bell___healthy": ("No disease symptoms detected. The pepper leaf appears healthy.",
        ["Use drip irrigation", "Rotate crops", "Scout for aphids and spots"], ["No treatment required"]),
    "Potato___Early_blight": (
        "Fungal disease (Alternaria solani) with dark brown concentric 'target' rings on older leaves, causing yellowing and defoliation.",
        ["Rotate crops (3 years)", "Use certified seed tubers", "Keep plants well fertilised and irrigated, avoid stress"],
        ["Apply chlorothalonil, mancozeb or azoxystrobin at first symptoms", "Remove infected lower leaves"]),
    "Potato___Late_blight": (
        "Aggressive oomycete disease (Phytophthora infestans) with water-soaked dark lesions, white mould underside and rapid plant collapse. Cause of the Irish famine.",
        ["Plant certified resistant varieties", "Destroy volunteer potatoes and cull piles", "Hill soil to protect tubers", "Avoid overhead irrigation"],
        ["Apply protectant fungicides (chlorothalonil, mancozeb) then systemic (metalaxyl, cymoxanil) in wet weather", "Destroy infected haulm before harvest"]),
    "Potato___healthy": ("No disease symptoms detected. The potato leaf appears healthy.",
        ["Use certified seed", "Rotate crops", "Monitor weather for blight risk"], ["No treatment required"]),
    "Raspberry___healthy": ("No disease symptoms detected. The raspberry leaf appears healthy.",
        ["Thin canes for airflow", "Remove old fruited canes", "Avoid waterlogged soil"], ["No treatment required"]),
    "Soybean___healthy": ("No disease symptoms detected. The soybean leaf appears healthy.",
        ["Rotate with corn or small grains", "Use quality seed", "Scout for aphids and rust"], ["No treatment required"]),
    "Squash___Powdery_mildew": (
        "Fungal disease (Podosphaera xanthii) producing white powdery patches on leaves that reduce photosynthesis and yield.",
        ["Plant resistant varieties", "Space plants for airflow", "Water in the morning at the soil level"],
        ["Spray sulfur, neem oil, potassium bicarbonate or a labelled fungicide", "Remove heavily infected leaves"]),
    "Strawberry___Leaf_scorch": (
        "Fungal disease (Diplocarpon earlianum) causing purple blotches that merge and make leaf edges look scorched.",
        ["Use disease-free plants", "Renovate beds after harvest and remove old leaves", "Avoid overhead watering"],
        ["Apply captan or myclobutanil fungicide", "Remove infected foliage"]),
    "Strawberry___healthy": ("No disease symptoms detected. The strawberry leaf appears healthy.",
        ["Use raised beds with good drainage", "Mulch with straw", "Renew plantings every 3 years"], ["No treatment required"]),
    "Tomato___Bacterial_spot": (
        "Bacterial disease (Xanthomonas spp.) causing small dark greasy spots on leaves and rough scabby fruit spots.",
        ["Use pathogen-free seed and transplants", "Rotate crops for 2-3 years", "Avoid overhead irrigation and handling wet plants"],
        ["Apply copper-based bactericide with mancozeb", "Remove and destroy infected plants late in the season"]),
    "Tomato___Early_blight": (
        "Fungal disease (Alternaria solani) with brown concentric 'bull's-eye' spots on older leaves and stem lesions.",
        ["Rotate crops", "Mulch to prevent soil splash", "Stake and prune to improve airflow", "Remove infected lower leaves"],
        ["Apply chlorothalonil, mancozeb or copper fungicide every 7-10 days", "Maintain plant nutrition"]),
    "Tomato___Late_blight": (
        "Oomycete disease (Phytophthora infestans) causing large greasy grey-green lesions and white mould in humid weather; can destroy a crop in days.",
        ["Plant resistant varieties", "Avoid wet foliage; water early in the day", "Remove volunteer tomatoes and potatoes"],
        ["Apply preventive chlorothalonil or copper fungicide; use systemic products after infection", "Remove and bag (do not compost) infected plants"]),
    "Tomato___Leaf_Mold": (
        "Fungal disease (Passalora fulva) with pale yellow patches on upper leaf surfaces and olive-brown mould underneath, common in humid greenhouses.",
        ["Reduce humidity and ventilate greenhouses", "Space plants widely", "Use resistant cultivars"],
        ["Apply chlorothalonil or copper fungicide", "Remove infected leaves"]),
    "Tomato___Septoria_leaf_spot": (
        "Fungal disease (Septoria lycopersici) with many small circular spots with dark borders and grey centres, starting on lower leaves.",
        ["Rotate crops (3 years)", "Mulch and avoid overhead watering", "Clear plant debris"],
        ["Apply chlorothalonil or mancozeb at first symptoms", "Remove infected lower leaves"]),
    "Tomato___Spider_mites Two-spotted_spider_mite": (
        "Pest damage by two-spotted spider mites (Tetranychus urticae): fine stippling, bronzing and webbing on leaves in hot, dry conditions.",
        ["Keep plants well watered to reduce stress", "Encourage predatory mites", "Avoid broad-spectrum insecticides that kill natural enemies"],
        ["Spray with water to dislodge mites", "Apply insecticidal soap, neem oil or a miticide (abamectin)"]),
    "Tomato___Target_Spot": (
        "Fungal disease (Corynespora cassiicola) with brown spots with concentric rings and yellow halos on leaves and fruit.",
        ["Improve airflow through staking and pruning", "Rotate crops", "Avoid overhead irrigation"],
        ["Apply chlorothalonil, azoxystrobin or mancozeb", "Remove infected leaves"]),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": (
        "Viral disease (TYLCV) transmitted by whiteflies; leaves curl upward and turn yellow, plants are stunted with poor fruit set.",
        ["Control whiteflies (yellow sticky traps, insect nets)", "Use resistant/tolerant varieties", "Remove weeds and infected plants promptly"],
        ["No cure for infected plants: rogue and destroy them", "Use insecticides or neem oil to reduce whitefly spread"]),
    "Tomato___Tomato_mosaic_virus": (
        "Viral disease (ToMV) causing mottled light/dark green mosaic and distorted, fern-like leaves; spreads mechanically and on seed.",
        ["Use virus-free seed and resistant varieties", "Wash hands and disinfect tools", "Do not smoke or handle tobacco before touching plants"],
        ["No cure: remove and destroy infected plants", "Disinfect stakes, tools and greenhouse surfaces"]),
    "Tomato___healthy": ("No disease symptoms detected. The tomato leaf appears healthy.",
        ["Rotate crops", "Mulch and water at the base", "Scout weekly for early signs of disease"], ["No treatment required"]),
}


def _pretty(s: str) -> str:
    s = s.replace("_", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s


def parse_class(name: str) -> tuple[str, str]:
    """'Tomato___Early_blight' -> ('Tomato', 'Early blight'); 'Corn_(maize)___x' -> ('Corn', ...)."""
    crop, _, disease = name.partition("___")
    crop = re.sub(r"\(.*?\)", "", crop).replace(",", "")
    disease = re.sub(r"\(.*?\)", "", disease)
    return _pretty(crop), (_pretty(disease) or "Unknown")


def build_mapping(class_names: list[str]) -> dict[str, dict]:
    out = {}
    for cls in class_names:
        crop, disease = parse_class(cls)
        healthy = disease.lower() == "healthy"
        if cls in DISEASES:
            desc, prev, treat = DISEASES[cls]
        else:  # generic fallback for classes added to the dataset later
            desc = f"{crop} leaf {'without visible disease' if healthy else 'affected by ' + disease}."
            prev = ["Practise crop rotation", "Keep foliage dry and improve airflow", "Remove infected plant material"]
            treat = ["No treatment required"] if healthy else ["Consult a local agricultural extension service"]
        out[cls] = {
            "class_name": cls, "plant": crop, "disease": "None (Healthy)" if healthy else disease,
            "status": "Healthy" if healthy else "Diseased",
            "description": desc, "prevention": prev, "treatment": treat,
        }
    return out
