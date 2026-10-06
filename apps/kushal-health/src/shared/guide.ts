// Plain-language guide per marker key. General health information only: same text for anyone,
// no personal values, no medicine names or doses. Every key in the kushal-health skill's markers.md needs `what`.

export interface Guide {
  /** What the test measures, in everyday words. */
  what: string
  /** What a high result can mean over time. */
  high?: string
  /** What a low result can mean over time. */
  low?: string
  /** Safe next steps when high. */
  doHigh?: string[]
  /** Safe next steps when low. */
  doLow?: string[]
}

const RECHECK = 'Repeat this test in about 3 months to see the direction'
const DOCTOR = 'Show this result to a doctor'

export const GUIDE: Record<string, Guide> = {
  // Thyroid
  tsh: {
    what: 'The signal your brain sends to tell the thyroid gland (in your neck) to make its hormones. The thyroid sets how fast your body burns energy.',
    high: 'The brain is pushing harder than normal, which often means the thyroid is slowing down. Left alone this can bring tiredness, weight gain, feeling cold, dry skin, low mood and higher cholesterol.',
    low: 'The thyroid may be working too hard. This can bring a fast heartbeat, weight loss, feeling hot, anxiety and poor sleep.',
    doHigh: [
      `${DOCTOR}; ask whether you need anti-TPO antibodies and a repeat TSH with free T4`,
      'Note symptoms like tiredness, feeling cold, weight change or hair fall to share with the doctor',
      'Do not start thyroid medicine or supplements on your own',
    ],
    doLow: [`${DOCTOR}; a repeat test with free T3 and free T4 is usually the next step`],
  },
  ft4: {
    what: 'Free T4, the main hormone the thyroid makes, in the form your body can use right now.',
    high: 'Too much thyroid hormone can speed the body up: fast heartbeat, weight loss, anxiety.',
    low: 'Too little thyroid hormone slows the body down: tiredness, weight gain, feeling cold.',
    doHigh: [DOCTOR],
    doLow: [DOCTOR],
  },
  ft3: {
    what: 'Free T3, the active thyroid hormone that works inside your cells.',
    high: 'Can mean an overactive thyroid.',
    low: 'Can mean an underactive thyroid, or a body under strain from illness or dieting.',
    doHigh: [DOCTOR],
    doLow: [DOCTOR],
  },
  t3_total: { what: 'Total T3, all of the active thyroid hormone in the blood, bound and free.', high: 'Can mean an overactive thyroid.', low: 'Can mean an underactive thyroid.', doHigh: [DOCTOR], doLow: [DOCTOR] },
  t4_total: { what: 'Total T4, all of the main thyroid hormone in the blood, bound and free.', high: 'Can mean an overactive thyroid.', low: 'Can mean an underactive thyroid.', doHigh: [DOCTOR], doLow: [DOCTOR] },
  anti_tpo: {
    what: 'Antibodies against the thyroid. They show whether your immune system is attacking the thyroid gland.',
    high: 'The immune system may be slowly damaging the thyroid, a common cause of an underactive thyroid.',
    doHigh: [DOCTOR, 'Keep checking TSH regularly'],
  },
  anti_tg: {
    what: 'Antibodies against thyroglobulin, a thyroid protein. They show whether your immune system is attacking the thyroid.',
    high: 'The immune system may be targeting the thyroid.',
    doHigh: [DOCTOR],
  },

  // Heart & fats
  ldl: {
    what: 'LDL is the "bad" cholesterol. It carries fat into your blood vessels.',
    high: 'Extra LDL slowly builds up as plaque inside artery walls. Over years this raises the risk of heart attack and stroke. It gives no symptoms, so the number is the only warning.',
    doHigh: [
      'Eat more fibre: oats, dal, beans, vegetables, fruit',
      'Cut fried food, ghee, butter, bakery items and processed meat',
      'Move at least 150 minutes a week, like a 30-minute brisk walk 5 days',
      RECHECK,
      `${DOCTOR}; if it stays high they may suggest medicine`,
    ],
  },
  hdl: {
    what: 'HDL is the "good" cholesterol. It carries extra cholesterol away from your arteries.',
    low: 'Less HDL means less clean-up, so heart risk goes up.',
    doLow: ['Regular exercise raises HDL', 'Stop smoking if you smoke', 'Swap fried snacks for nuts and seeds'],
  },
  cholesterol_total: {
    what: 'All the cholesterol in your blood, good and bad together.',
    high: 'Usually driven by high LDL; the risk is the same: plaque in the arteries over years.',
    doHigh: ['Same steps as for LDL: more fibre, less fried and fatty food, regular exercise', RECHECK],
  },
  non_hdl: {
    what: 'All the "bad" cholesterol types added together (total minus HDL).',
    high: 'A good single number for heart risk; high means more fat available to build up in arteries.',
    doHigh: ['Same steps as for LDL and triglycerides', RECHECK],
  },
  vldl: { what: 'VLDL carries triglycerides (blood fat) through the blood.', high: 'Moves with triglycerides; high adds to heart risk.', doHigh: ['Cut sugar and refined carbs', 'Exercise regularly'] },
  triglycerides: {
    what: 'The main fat in your blood. It comes from extra calories, sugar, refined carbs and alcohol.',
    high: 'High levels add to heart risk, often go with weight gain around the belly, and very high levels can harm the pancreas.',
    doHigh: [
      'Cut sugar, sweets, sweet drinks and juices',
      'Swap white rice, maida and white bread for whole grains',
      'Limit alcohol',
      'Exercise regularly; it lowers triglycerides quickly',
    ],
  },
  apo_a1: { what: 'The main protein in "good" HDL cholesterol.', low: 'Lower protection for the heart.', doLow: ['Exercise regularly'] },
  apo_b: { what: 'Counts the "bad" cholesterol particles. A sharper heart-risk test than LDL alone.', high: 'More particles that can build plaque in arteries.', doHigh: ['Same steps as for LDL', DOCTOR] },
  lp_a: { what: 'Lipoprotein(a), a type of cholesterol particle set mostly by your genes.', high: 'Raises heart risk; diet changes it very little.', doHigh: [DOCTOR, 'Keep other heart risks (LDL, blood pressure, smoking) low'] },

  // Kidneys
  uric_acid: {
    what: 'A waste product your body makes when it breaks down purines (found in red meat, organ meat, seafood and beer). The kidneys flush it out.',
    high: 'Extra uric acid can form crystals in joints, causing gout (sudden, very painful swelling, often in the big toe), and can lead to kidney stones.',
    doHigh: [
      'Drink more water through the day',
      'Cut red meat, organ meat, shellfish and beer',
      'Cut sugary drinks and packaged juices',
      'Keep a healthy weight; avoid crash diets',
    ],
  },
  urea: {
    what: 'A waste product made when your body uses protein. The kidneys remove it.',
    high: 'Often from not drinking enough water or eating a lot of protein; less often a sign the kidneys are struggling.',
    doHigh: ['Drink more water, especially the day before a test', 'Check creatinine and eGFR too: if they are normal the kidneys are filtering well', RECHECK],
  },
  bun: {
    what: 'Blood urea nitrogen, the same protein waste as urea, measured another way.',
    high: 'Often from dehydration or a high-protein diet; less often from kidney strain.',
    doHigh: ['Drink more water', 'Look at creatinine and eGFR together with this', RECHECK],
  },
  creatinine: {
    what: 'Waste from your muscles. How well the kidneys clear it is the main kidney check.',
    high: 'Can mean the kidneys are filtering less well. Big muscles or a high-protein diet can also raise it.',
    doHigh: [DOCTOR, 'Drink enough water'],
  },
  egfr: {
    what: 'An estimate of how much blood your kidneys clean each minute. 90 or above is normal.',
    low: 'Lower numbers mean the kidneys are filtering less well.',
    doLow: [DOCTOR],
  },
  calcium: { what: 'The mineral for bones, teeth, muscles and nerves.', high: 'Can come from too many supplements or a gland problem.', low: 'Can come with low vitamin D.', doHigh: [DOCTOR], doLow: [DOCTOR] },
  magnesium: { what: 'A mineral for muscles, nerves and sleep.', low: 'Can cause cramps and tiredness.', doLow: ['Eat nuts, seeds, leafy greens and whole grains'] },
  phosphorus: { what: 'A mineral that works with calcium for bones and energy.', high: 'Mild rises are common after a high-protein meal.', doHigh: [RECHECK] },

  // Liver
  bilirubin_total: {
    what: 'A yellow pigment made when old red blood cells break down. The liver clears it.',
    high: 'A mild rise with normal liver enzymes (SGOT, SGPT) is common and often harmless; fasting before the test can raise it. A doctor can confirm.',
    doHigh: ['See a doctor quickly if your eyes or skin turn yellow', 'Do not fast longer than needed before the next test', 'Mention it to a doctor at your next visit'],
  },
  bilirubin_direct: {
    what: 'The part of bilirubin the liver has already processed.',
    high: 'Clearly high levels can point to a liver or bile-duct issue; small rises often mean little.',
    doHigh: ['Check it with your liver enzymes', DOCTOR],
  },
  bilirubin_indirect: {
    what: 'The part of bilirubin not yet processed by the liver.',
    high: 'A mild rise with normal liver enzymes is common and often harmless.',
    doHigh: ['Mention it to a doctor', 'Avoid long fasting before tests'],
  },
  sgot: { what: 'SGOT (AST), an enzyme found in the liver and muscles.', high: 'Can mean liver strain, or recent hard exercise.', doHigh: ['Limit alcohol', DOCTOR] },
  sgpt: { what: 'SGPT (ALT), an enzyme found mostly in the liver. The main liver-health check.', high: 'Can mean liver strain, often fatty liver or alcohol.', doHigh: ['Limit alcohol and sugar', 'Lose belly weight', DOCTOR] },
  ggt: { what: 'An enzyme from the liver and bile ducts.', high: 'Often rises with alcohol or fatty liver.', doHigh: ['Limit alcohol', DOCTOR] },
  alp: { what: 'Alkaline phosphatase, an enzyme from the liver and bones.', high: 'Can come from the liver, bile ducts or bones.', doHigh: [DOCTOR] },
  protein_total: { what: 'All the proteins in your blood.', high: 'Often from dehydration.', low: 'Can come with poor nutrition.', doHigh: ['Drink enough water'], doLow: [DOCTOR] },
  albumin: { what: 'The main blood protein, made by the liver.', low: 'Can come with poor nutrition or liver issues.', doLow: [DOCTOR] },
  globulin: { what: 'Proteins that include your antibodies.', high: 'Can rise with infection or inflammation.', doHigh: [RECHECK] },

  // Sugar
  glucose_fasting: {
    what: 'Your blood sugar after not eating overnight.',
    high: 'Can be an early sign of prediabetes or diabetes.',
    low: 'Low sugar can cause shakiness and dizziness.',
    doHigh: ['Cut sugar and refined carbs', 'Exercise regularly', DOCTOR],
    doLow: [DOCTOR],
  },
  glucose_pp: {
    what: 'Your blood sugar about 2 hours after a meal.',
    high: 'Sugar that stays high after meals can be an early sign of prediabetes or diabetes.',
    doHigh: ['Walk for 10–15 minutes after meals', 'Cut sugar and refined carbs', DOCTOR],
  },
  hba1c: {
    what: 'Your average blood sugar over the last 2–3 months. Under 5.7% is normal; 5.7–6.4% is prediabetes.',
    high: 'Sugar running high for months damages blood vessels, eyes, kidneys and nerves over time.',
    doHigh: ['Cut sugar, sweets and refined carbs', 'Walk after meals', 'Keep a healthy weight', DOCTOR],
  },

  // Vitamins
  vit_d: {
    what: 'Vitamin D keeps bones strong and helps muscles and immunity. Your skin makes it from sunlight.',
    low: 'Low vitamin D over time can weaken bones and cause tiredness, muscle aches and low mood. It is very common in people who work indoors.',
    high: 'Very high levels usually come from taking too many supplements.',
    doLow: [
      '15–20 minutes of midday sun on arms and legs, a few days a week',
      'Eat eggs, fatty fish and fortified milk',
      'Ask a doctor whether you need a vitamin D supplement and how much',
      RECHECK,
    ],
    doHigh: ['Stop extra vitamin D supplements and tell a doctor'],
  },
  vit_b12: {
    what: 'Vitamin B12 keeps nerves and red blood cells healthy. It comes from animal foods.',
    low: 'Low B12 can cause tiredness, tingling in hands and feet, poor memory and anaemia. Common in vegetarians.',
    doLow: ['Eat more dairy, eggs, or fortified foods', 'Ask a doctor whether you need a B12 supplement'],
  },
  iron: { what: 'Iron in your blood right now. It goes up and down through the day.', low: 'Can point to low iron stores; check ferritin.', high: 'A single high reading is often from a recent meal.', doLow: ['Eat leafy greens, dal, jaggery, meat; add vitamin C (lemon) to meals'], doHigh: [RECHECK] },
  ferritin: { what: 'Your stored iron. The best single check of iron levels.', low: 'Low stores can lead to anaemia, tiredness and hair fall.', high: 'Can rise with inflammation or iron overload.', doLow: ['Eat iron-rich food with vitamin C', DOCTOR], doHigh: [DOCTOR] },
  tibc: { what: 'How much iron your blood could carry. High when iron is low.', high: 'Can mean low iron.', doHigh: ['Look at ferritin'] },
  uibc: { what: 'The unused room for iron in your blood.', high: 'Can mean low iron.', doHigh: ['Look at ferritin'] },
  transferrin_sat: { what: 'How full your blood’s iron carriers are.', low: 'Can mean low iron.', high: 'Can mean iron overload.', doLow: ['Look at ferritin'], doHigh: [DOCTOR] },

  // Blood cells
  hemoglobin: {
    what: 'The protein in red blood cells that carries oxygen around the body.',
    low: 'Anaemia: tiredness, breathlessness, pale skin.',
    high: 'Thicker blood; often from dehydration or smoking.',
    doLow: [DOCTOR],
    doHigh: ['Drink more water', RECHECK],
  },
  hematocrit: {
    what: 'How much of your blood is made of red blood cells.',
    high: 'Thicker blood. Often from not drinking enough water; also smoking or living at high altitude. Very thick blood raises clot risk.',
    doHigh: ['Drink more water, especially before the test', 'Stop smoking if you smoke', RECHECK],
  },
  rbc: {
    what: 'The number of red blood cells, which carry oxygen.',
    high: 'Can come from dehydration, smoking, or an inherited trait that makes many small red cells. A doctor can tell which.',
    doHigh: ['Drink more water', `${DOCTOR}, especially if MCV and MCH are also low`],
  },
  mcv: { what: 'The average size of your red blood cells.', low: 'Small red cells can come from low iron or an inherited trait.', high: 'Large red cells can come from low B12 or folate.', doLow: ['Check ferritin', DOCTOR], doHigh: ['Check B12', DOCTOR] },
  mch: { what: 'How much haemoglobin is in each red blood cell.', low: 'Often goes with small red cells (low MCV).', doLow: ['Check ferritin', DOCTOR] },
  mchc: { what: 'How concentrated the haemoglobin is in red cells.', low: 'Can come with low iron.', doLow: ['Check ferritin'] },
  rdw_sd: { what: 'How much your red blood cells vary in size.', high: 'Mixed sizes can come with low iron or B12.', doHigh: ['Check ferritin and B12'] },
  rdw_cv: { what: 'How much your red blood cells vary in size (as a percent).', high: 'Mixed sizes can come with low iron or B12.', doHigh: ['Check ferritin and B12'] },
  wbc: { what: 'White blood cells, your infection fighters.', high: 'Often from an infection or stress.', low: 'Fewer infection fighters.', doHigh: [RECHECK], doLow: [DOCTOR] },
  neutrophils_pct: { what: 'The share of white cells that fight bacteria.', low: 'Often just a shift as other white cells rise.', high: 'Often from a bacterial infection.', doLow: ['Look at the absolute count'], doHigh: [RECHECK] },
  lymphocytes_pct: {
    what: 'The share of white cells that fight viruses and make antibodies.',
    high: 'Often after a recent viral infection. If it stays high on several tests, a doctor should look.',
    doHigh: [RECHECK, 'Show it to a doctor if it stays high'],
  },
  monocytes_pct: { what: 'The share of white cells that clean up germs and dead cells.', high: 'Can rise during recovery from infection.', doHigh: [RECHECK] },
  eosinophils_pct: { what: 'The share of white cells linked to allergies and parasites.', high: 'Often from allergies.', doHigh: [RECHECK] },
  basophils_pct: { what: 'The share of white cells involved in allergic reactions.', high: 'Can rise with allergies.', doHigh: [RECHECK] },
  neutrophils_abs: { what: 'The number of white cells that fight bacteria.', low: 'Fewer bacteria fighters.', high: 'Often from infection.', doLow: [DOCTOR], doHigh: [RECHECK] },
  lymphocytes_abs: {
    what: 'The number of white cells that fight viruses.',
    high: 'Often after a viral infection. If it stays high on several tests, a doctor should look.',
    doHigh: [RECHECK, 'Show it to a doctor if it stays high'],
  },
  monocytes_abs: { what: 'The number of clean-up white cells.', high: 'Can rise during recovery from infection.', doHigh: [RECHECK] },
  eosinophils_abs: { what: 'The number of allergy-linked white cells.', high: 'Often from allergies.', doHigh: [RECHECK] },
  basophils_abs: { what: 'The number of white cells involved in allergic reactions.', high: 'Can rise with allergies.', doHigh: [RECHECK] },
  platelets: { what: 'Platelets help your blood clot when you get a cut.', low: 'Easier bruising and bleeding.', high: 'Can rise with inflammation.', doLow: [DOCTOR], doHigh: [RECHECK] },
  mpv: { what: 'The average size of your platelets.', high: 'Larger platelets are usually younger ones; on its own this rarely matters.', doHigh: ['Look at the platelet count; if it is normal this is usually minor'] },
  pdw: { what: 'How much your platelets vary in size.', high: 'On its own this rarely matters.', doHigh: ['Look at the platelet count'] },
  plcr: { what: 'The share of large platelets.', high: 'On its own this rarely matters.', doHigh: ['Look at the platelet count'] },
  pct: { what: 'The share of blood volume made of platelets.', high: 'Usually follows the platelet count.' },
  esr: { what: 'A general inflammation test: how fast red cells settle in a tube.', high: 'Points to inflammation somewhere in the body.', doHigh: [RECHECK, DOCTOR] },

  // Hormones
  testosterone: {
    what: 'The main male hormone. Supports energy, muscle, mood and sex drive.',
    low: 'Can bring low energy, low sex drive, low mood and muscle loss.',
    doLow: ['Sleep 7–8 hours', 'Strength training', 'Keep a healthy weight', DOCTOR],
  },
  free_testosterone: { what: 'The part of testosterone your body can use right now.', low: 'Can bring low energy and low sex drive.', doLow: [DOCTOR] },
  shbg: { what: 'A protein that holds onto testosterone, so less of it is free to use.', high: 'Less free testosterone available.', low: 'Often goes with belly weight and insulin resistance.', doHigh: [DOCTOR], doLow: ['Exercise and keep a healthy weight'] },
  dht: { what: 'A strong hormone made from testosterone. Linked to body hair and hair loss.', high: 'Can speed up scalp hair loss in some men.', doHigh: ['Mention it if you notice hair thinning'] },
  androstenedione: {
    what: 'A hormone from the adrenal glands and testes that the body turns into testosterone and estrogen.',
    low: 'On its own a low value usually matters little; it is read together with cortisol and testosterone.',
    doLow: ['Read it together with cortisol and testosterone with a doctor'],
  },
  estradiol: { what: 'The main estrogen. Men need a little for bones and mood.', high: 'Higher estrogen in men often comes with belly fat.', doHigh: ['Keep a healthy weight', DOCTOR] },
  prolactin: {
    what: 'A hormone from the pituitary gland in the brain.',
    high: 'In men, high prolactin can lower testosterone and sex drive. Stress, poor sleep, hard exercise before the test and some medicines can raise it; rarely, a small harmless growth in the pituitary causes it.',
    doHigh: [
      'Repeat it rested: morning, no hard exercise, calm, after good sleep',
      'Tell the doctor about every medicine you take',
      `${DOCTOR}, especially if it stays high on repeat`,
    ],
  },
  fsh: {
    what: 'A brain hormone that tells the testes to make sperm.',
    low: 'Slightly low on its own often matters little; read it with LH and testosterone.',
    high: 'Can mean the testes are working harder.',
    doLow: ['Read it together with LH and testosterone with a doctor'],
    doHigh: [DOCTOR],
  },
  lh: { what: 'A brain hormone that tells the testes to make testosterone.', low: 'Can come with low testosterone.', high: 'Can mean the testes are working harder.', doLow: [DOCTOR], doHigh: [DOCTOR] },
  cortisol: {
    what: 'The body’s main stress hormone, made by the adrenal glands. It is highest in the morning, so it must be tested between 6 and 10 am.',
    low: 'A low morning value can mean the adrenal glands are making too little, which can cause tiredness, dizziness and low blood pressure. A sample taken before 6 am or later in the day reads low by itself.',
    high: 'Long-term high cortisol can raise blood sugar, blood pressure and belly weight.',
    doLow: ['Repeat it at about 8 am', `${DOCTOR} if it is low again or you feel very tired or dizzy`],
    doHigh: ['Repeat it in the morning, calm and rested', DOCTOR],
  },
  hgh: { what: 'Growth hormone. In adults it helps keep muscle and bone.', high: 'A single high reading is often from exercise or sleep timing.', doHigh: [RECHECK] },

  // Other
  psa: { what: 'A protein made by the prostate gland. Used to watch prostate health in men.', high: 'Can rise with an enlarged or inflamed prostate, and needs a doctor to judge.', doHigh: [DOCTOR] },
  psa_free: { what: 'The unbound part of PSA. Read together with total PSA.', high: 'When total PSA is normal, a higher free part is usually reassuring.', doHigh: ['Read it together with total PSA'] },
  psa_free_pct: { what: 'Free PSA as a share of total PSA. A higher share is more reassuring.', low: 'A low share needs a doctor to judge.', doLow: [DOCTOR] },
  crp: {
    what: 'hs-CRP measures low-level inflammation in the body. It is used as a heart-risk marker.',
    high: 'Higher values go with higher heart risk; a cold or injury can also raise it for a while.',
    doHigh: ['Repeat when you are well', 'Exercise, sleep well, and keep a healthy weight'],
  },
  hbsag: { what: 'Checks for hepatitis B infection. "Non reactive" means it was not found.', high: 'A reactive result needs a doctor.', doHigh: [DOCTOR] },
}

/** One line on what each body area does, for the "What this means" cards. */
export const PART_INTRO: Record<string, string> = {
  thyroid: 'The thyroid gland in your neck sets how fast your body uses energy.',
  heart: 'Cholesterol and blood fats decide how fast plaque builds up in your arteries.',
  kidney: 'Your kidneys filter waste out of the blood.',
  liver: 'Your liver cleans the blood and processes old red cells.',
  sugar: 'These show how well your body handles sugar.',
  vitamins: 'Vitamins and iron your body needs to stay strong.',
  blood: 'Your blood cells carry oxygen, fight infection and help clotting.',
  hormones: 'Hormones are chemical messengers for energy, stress, mood and sex drive.',
  other: 'Other checks from your reports.',
}
