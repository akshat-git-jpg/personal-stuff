# Marker keys

Canonical key per test. A key is a chart line's identity in the app: never rename one that
data already uses. Add a row when a lab prints a test that is not here.

| key | panel | names seen on reports |
|---|---|---|
| hba1c | Diabetes | HbA1c, Glycated Haemoglobin, Glycosylated Hemoglobin |
| glucose_fasting | Diabetes | Fasting Blood Sugar, FBS, Glucose Fasting, Plasma Glucose (F) |
| glucose_pp | Diabetes | Post Prandial Blood Sugar, PPBS, Glucose PP |
| cholesterol_total | Lipid | Total Cholesterol, Cholesterol Total, S. Cholesterol |
| hdl | Lipid | HDL Cholesterol, HDL-C |
| ldl | Lipid | LDL Cholesterol, LDL-C, LDL Direct |
| vldl | Lipid | VLDL Cholesterol |
| triglycerides | Lipid | Triglycerides, TG |
| non_hdl | Lipid | Non-HDL Cholesterol |
| tsh | Thyroid | TSH, Thyroid Stimulating Hormone, TSH Ultrasensitive |
| t3_total | Thyroid | T3, Total T3, Triiodothyronine |
| t4_total | Thyroid | T4, Total T4, Thyroxine |
| ft3 | Thyroid | Free T3, FT3 |
| ft4 | Thyroid | Free T4, FT4 |
| anti_tpo | Thyroid | Anti TPO, Anti Thyroid Peroxidase Antibody |
| anti_tg | Thyroid | Anti Thyroglobulin, aTg, Anti-Tg Antibody |
| sgot | Liver | SGOT, AST, Aspartate Aminotransferase |
| sgpt | Liver | SGPT, ALT, Alanine Aminotransferase |
| alp | Liver | Alkaline Phosphatase, ALP |
| ggt | Liver | GGT, Gamma GT |
| bilirubin_total | Liver | Total Bilirubin, Bilirubin Total |
| albumin | Liver | Albumin, S. Albumin |
| creatinine | Kidney | Creatinine, S. Creatinine |
| urea | Kidney | Urea, Blood Urea |
| bun | Kidney | BUN, Blood Urea Nitrogen |
| uric_acid | Kidney | Uric Acid, S. Uric Acid |
| egfr | Kidney | eGFR |
| hemoglobin | CBC | Haemoglobin, Hemoglobin, Hb |
| wbc | CBC | Total Leucocyte Count, TLC, WBC Count |
| platelets | CBC | Platelet Count, Platelets |
| rbc | CBC | RBC Count, Total RBC |
| esr | CBC | ESR |
| vit_d | Vitamins | Vitamin D, 25-OH Vitamin D, 25 Hydroxy Vitamin D |
| vit_b12 | Vitamins | Vitamin B12, Cyanocobalamin |
| iron | Vitamins | Serum Iron, Iron |
| ferritin | Vitamins | Ferritin |
| testosterone | Hormones | Testosterone Total |
| crp | Other | CRP, C-Reactive Protein, hs-CRP |
| hbsag | Other | HBsAg |
| apo_a1 | Lipid | Apolipoprotein A1, APO-A1 |
| apo_b | Lipid | Apolipoprotein B, APO-B |
| lp_a | Lipid | Lipoprotein (a), Lp(a) |
| bilirubin_direct | Liver | Bilirubin Direct, Conjugated Bilirubin |
| bilirubin_indirect | Liver | Bilirubin Indirect, Unconjugated Bilirubin |
| protein_total | Liver | Total Protein, Protein - Total |
| globulin | Liver | Serum Globulin |
| calcium | Kidney | Calcium, S. Calcium |
| hematocrit | CBC | Hematocrit, PCV, Packed Cell Volume |
| mcv | CBC | Mean Corpuscular Volume, MCV |
| mch | CBC | Mean Corpuscular Hemoglobin, MCH |
| mchc | CBC | Mean Corp. Hemo. Conc, MCHC |
| rdw_sd | CBC | RDW-SD |
| rdw_cv | CBC | RDW-CV |
| neutrophils_pct | CBC | Neutrophils, Neutrophils Percentage |
| lymphocytes_pct | CBC | Lymphocyte, Lymphocytes Percentage |
| monocytes_pct | CBC | Monocytes, Monocytes Percentage |
| eosinophils_pct | CBC | Eosinophils, Eosinophils Percentage |
| basophils_pct | CBC | Basophils, Basophils Percentage |
| neutrophils_abs | CBC | Neutrophils - Absolute Count |
| lymphocytes_abs | CBC | Lymphocytes - Absolute Count |
| monocytes_abs | CBC | Monocytes - Absolute Count |
| eosinophils_abs | CBC | Eosinophils - Absolute Count |
| basophils_abs | CBC | Basophils - Absolute Count |
| mpv | CBC | Mean Platelet Volume, MPV |
| pdw | CBC | Platelet Distribution Width, PDW |
| plcr | CBC | Platelet to Large Cell Ratio, PLCR |
| pct | CBC | Plateletcrit, PCT |
| tibc | Vitamins | Total Iron Binding Capacity, TIBC |
| uibc | Vitamins | Unsat. Iron-Binding Capacity, UIBC |
| transferrin_sat | Vitamins | % Transferrin Saturation |
| free_testosterone | Hormones | Free Testosterone |
| shbg | Hormones | Sex Hormone Binding Globulin, SHBG |
| dht | Hormones | Dihydrotestosterone, DHT |
| androstenedione | Hormones | Androstenedione, A4 |
| estradiol | Hormones | Estradiol, Oestrogen, E2 |
| prolactin | Hormones | Prolactin, PRL |
| fsh | Hormones | Follicle Stimulating Hormone, FSH |
| lh | Hormones | Luteinising Hormone, LH |
| cortisol | Hormones | Cortisol |
| hgh | Hormones | Human Growth Hormone, HGH |
| magnesium | Other | Magnesium |
| phosphorus | Other | Phosphorous, Phosphorus |
| psa | Other | Prostate Specific Antigen, PSA |
| psa_free | Other | Free PSA |
| psa_free_pct | Other | Percent Free PSA |

Every key here needs an entry in `apps/kushal-health/src/shared/guide.ts` (the plain-language
"what it is / why it matters / what to do" text). A test there fails when one is missing.
