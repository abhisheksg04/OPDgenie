import React, { useState, useMemo } from "react";
// Data sources for this rebuild:
// - Dosing, administration notes, and precautions: "Drug Dosages and Notes for Administration"
//   (uploaded reference; evidence-based, FDA/AAP/dailymed-cited where noted)
// - Brand names, exact compositions, and pack sizes: "OPD Pharmacy Formulations & Generic Names"
//   (the actual current OPD pharmacy stock list)
// Scope: only drugs physically stocked in the OPD pharmacy. Fixed-dose combinations and
// products flagged as not recommended in the source reference are still listed (since they
// are in stock and a doctor may need to document/recognize them) but are visually flagged
// and do not offer a calculated dose -- the reference explicitly says no invented dose should
// be given for these.
// Calculation aid only -- every output requires clinical verification before use.
const DRUGS = [
  // ================= EMERGENCY / RESUSCITATION =================
  {
    id: "epinephrine-im",
    name: "Epinephrine (IM \u2014 anaphylaxis, first-line)",
    category: "Emergency / Resuscitation",
    topicalOnly: true,
    minAgeMonths: 0,
    sig: "ANAPHYLAXIS FIRST-LINE \u2014 give IMMEDIATELY. IM 0.01mg/kg of 1:1,000 (1mg/mL) into the ANTEROLATERAL THIGH; MAX single dose 0.3mg (prepubertal child) or 0.5mg (adolescent/adult). REPEAT every 5-15 min if inadequate response. AUTO-INJECTOR equivalents: 0.15mg for ~7.5-30kg; 0.3mg for \u226530kg. Antihistamines and steroids are ADJUNCTS ONLY and never replace epinephrine.",
    brands: [
      { name: "Adrenaline 1:1,000 ampoule", manufacturer: "Various", strengths: [{ displayLabel: "1mg/mL (1:1,000) injection \u2014 draw 0.01mg/kg IM; the correct concentration for IM anaphylaxis" }] },
      { name: "Epinephrine auto-injector", manufacturer: "Various", strengths: [{ displayLabel: "0.15mg (15-<30kg) / 0.3mg (\u226530kg) \u2014 prescribe TWO devices; limited availability in India" }] },
    ],
    adminNote: "Lay the patient flat with legs raised (sit up if in respiratory distress; left lateral if vomiting/pregnant). Give IM into the mid-outer thigh \u2014 through clothing if needed. Call for emergency help, give high-flow oxygen, obtain IV access and give a fluid bolus for hypotension, add inhaled salbutamol for bronchospasm. Observe \u22654h after resolution (longer if severe, biphasic-risk, or delayed presentation). Discharge with an auto-injector prescription (two devices) and a written anaphylaxis action plan.",
    precaution: "Use the 1:1,000 (1mg/mL) ampoule for IM dosing \u2014 NOT the 1:10,000 cardiac-arrest concentration. There is no absolute contraindication in anaphylaxis. Fixed auto-injectors deliver only 0.15/0.3mg; use a drawn-up ampoule dose if a lower weight-based amount is needed. This entry is instruction-only (emergency, not a take-home calculated script).",
    notes: "Only therapy shown to reduce anaphylaxis fatality; under-use and delay are the main preventable harms.",
  },
  // ================= ANTIBIOTICS / ANTIVIRALS / ANTIPARASITICS =================
  {
    id: "amoxicillin",
    name: "Amoxicillin (plain)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 3,
    doseOptions: [
      { id: "aom-cap", label: "AOM / CAP high-dose (\u00f7Q12h)", low: 80, high: 90, freq: 2, maxDay: 4000 },
      { id: "standard", label: "Standard ENT / skin / GU, mild-moderate (\u00f7Q12h)", low: 25, high: 45, freq: 2, maxDay: 1750 },
      { id: "pharyngitis-od", label: "Strep pharyngitis: 50mg/kg ONCE daily (max 1000mg) x10 days", low: 50, high: 50, freq: 1, maxDay: 1000, singleDoseMax: 1000 },
      { id: "pharyngitis-bid", label: "Strep pharyngitis: 25mg/kg BID (max 500mg/dose) x10 days", low: 50, high: 50, freq: 2, maxDay: 1000, singleDoseMax: 500 },
    ],
    sourceNote: "Plain amoxicillin is first-line for AOM, CAP, and strep pharyngitis (AAP; PIDS/IDSA CAP guideline, Bradley et al., 2011; Sur & Plesa, Am Fam Physician, 2022) \u2014 the app previously stocked only amoxicillin-clavulanate, which is second-line for these. AOM/CAP high-dose is 80-90mg/kg/day divided q12h (twice-daily supported for AOM by middle-ear-fluid half-life data; CAP daily max 4g). Standard 25-45mg/kg/day q12h and the \u226540kg switch to fixed adult dosing (500mg q12h / 875mg q12h severe) both match the FDA amoxicillin label. Strep pharyngitis: 50mg/kg once daily (max 1000mg) OR 25mg/kg BID (max 500mg/dose), minimum 10-day course to prevent rheumatic fever.",
    defaultDurationDays: 10,
    brands: [
      { name: "Mox", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 125 }, { mgPer5ml: 250, displayLabel: "250mg/5mL (Mox 250 dry syrup)" }, { mgPerMl: 100, displayLabel: "100mg/mL drops" }, { tabletMg: 250, displayLabel: "250mg capsule" }, { tabletMg: 500, displayLabel: "500mg capsule" }] },
      { name: "Novamox", manufacturer: "Cipla", strengths: [{ mgPer5ml: 125 }, { mgPer5ml: 250, displayLabel: "250mg/5mL" }, { mgPerMl: 100, displayLabel: "100mg/mL drops" }, { tabletMg: 250, displayLabel: "250mg capsule" }, { tabletMg: 500, displayLabel: "500mg capsule" }] },
    ],
    adminNote: "With or without food (food does not meaningfully impair absorption). Shake well; reconstitute to the mark; REFRIGERATE and discard after 14 days. Complete the FULL course \u2014 minimum 10 days for any Streptococcus pyogenes infection to prevent rheumatic fever. At \u226540kg, switch to fixed adult dosing rather than continuing the mg/kg formula.",
    notes: "Confirm the exact reconstituted strength on the dispensed bottle before dosing \u2014 125 vs 250mg/5mL is a common source of 2-fold error.",
  },
  {
    id: "amoxiclav",
    name: "Amoxicillin-Clavulanate",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Standard BID (amox component)", low: 25, high: 45, freq: 2, maxDay: 1750 },
      { id: "high", label: "High-dose BID \u2014 AOM/resistant pneumococcus (amox component)", low: 90, high: 90, freq: 2, maxDay: 4000 },
      { id: "neonate", label: "Neonate / <12 weeks (amox component)", low: 30, high: 30, freq: 2, maxDay: 1000 },
    ],
    sourceNote: "The age/weight cutoffs document adds a threshold this app didn't have: at \u226540kg, switch to fixed ADULT dosing (500mg/875mg q12h) rather than continuing the weight-based mg/kg calculation -- the FDA label doesn't extend the pediatric weight-based formula past that point. For a child \u226540kg, use adult dosing directly rather than this calculator's mg/kg output; the Augmentin 1000 DUO tablet added below is the actual product for that regimen. Also confirms the neonate/<12-week regimen above (30mg/kg/day \u00f7q12h using the 125mg/5mL strength specifically, and do not exceed q12h dosing under 12 weeks) against the FDA amoxicillin-clavulanate label (2026). CORRECTION: tablet strengths (Augmentin-375, Augmentin 1000 DUO) were confirmed in this pharmacy's formulary from the very first search of this whole review, but were missed during the later systematic tablet-addition pass -- added now.",
    defaultDurationDays: 7,
    brands: [
      { name: "Augmentin ES", manufacturer: "GSK", strengths: [{ mgPer5ml: 600, displayLabel: "600mg amox + 42.9mg clav /5mL (Extra Strength)" }] },
      { name: "Augmentin Duo (Dry Syrup)", manufacturer: "GSK", strengths: [{ mgPer5ml: 200, displayLabel: "200mg amox + 28.5mg clav /5mL" }] },
      { name: "Augmentin-375 (tablet)", manufacturer: "GSK", strengths: [{ tabletMg: 250, displayLabel: "375mg tablet = 250mg amox + 125mg clav" }] },
      { name: "Augmentin 1000 DUO (tablet)", manufacturer: "GSK", strengths: [{ tabletMg: 875, displayLabel: "1000mg tablet = 875mg amox + 125mg clav -- this is the adult-dose tablet referenced in the \u226540kg switchover note above" }] },
      { name: "Advent Forte", manufacturer: "Cipla", strengths: [{ mgPer5ml: 400, displayLabel: "400mg amox + 57mg clav /5mL" }] },
      { name: "Advent (drops)", manufacturer: "Cipla", strengths: [{ mgPerMl: 80, displayLabel: "80mg amox + 11.4mg clav /mL" }] },
      { name: "Moxclav DSC-P", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 400, displayLabel: "400mg amox + 57mg clav /5mL" }] },
    ],
    adminNote: "Shake well; give at the START of a meal/feed to reduce GI upset and improve absorption. Prefer the q12h regimen -- significantly less diarrhea than q8h. Reconstitute to the mark; REFRIGERATE, discard after 10 days. Space \u22652h from any iron/zinc dose.",
    precaution: "Augmentin-375 has a 2:1 amoxicillin:clavulanate ratio. Dosing by amoxicillin component in children delivers a high clavulanate load associated with severe diarrhea. Pediatric oral dry syrups (4:1 or 7:1) are preferred.",
    notes: "This is the highest-yield refrigeration counseling point in the whole formulary -- very commonly prescribed and genuinely potency-dependent on cold storage, with the shortest in-use window (10 days) of any suspension here.",
  },
  {
    id: "cefixime",
    name: "Cefixime",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 2,
    doseOptions: [
      { id: "standard", label: "Standard (once daily or \u00f7Q12h)", low: 8, high: 8, freq: 2, maxDay: 400 },
      { id: "enteric", label: "Enteric fever (typhoid): 20mg/kg/day \u00f7Q12h", low: 20, high: 20, freq: 2, maxDay: 800 },
    ],
    sourceNote: "Age floor updated to 2 months per the age/weight cutoffs document (Veauthier & Miller, 2020). CORRECTION: an Enteric fever option (20mg/kg/day, from Meherban Singh) existed in an earlier pass of this project but was collapsed into a note claiming the standard 8mg/kg/day dose applied to both -- that note was wrong; enteric fever genuinely needs the higher 20mg/kg/day dose. Restored as its own option.",
    defaultDurationDays: 7,
    brands: [
      { name: "Taxim-O Forte", manufacturer: "Alkem", strengths: [{ mgPer5ml: 100 }] },
      { name: "Taxim-O", manufacturer: "Alkem", strengths: [{ mgPer5ml: 50 }] },
      { name: "Ziprax", manufacturer: "Cipla", strengths: [{ mgPer5ml: 100 }] },
    ],
    adminNote: "Shake well; with or without food. Suspension stable ~14 days after reconstitution per label; some brands don't require refrigeration -- check the specific label. Once-daily dosing is acceptable for compliance.",
    notes: "",
  },
  {
    id: "cefpodoxime",
    name: "Cefpodoxime Proxetil",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 2,
    doseOptions: [
      { id: "standard", label: "Standard (\u00f7Q12h)", low: 10, high: 10, freq: 2, maxDay: 400 },
    ],
    defaultDurationDays: 7,
    brands: [
      { name: "Cepodem 100", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 100 }, { tabletMg: 100, displayLabel: "100mg tablet" }] },
      { name: "Cepodem 50", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 50 }] },
    ],
    adminNote: "GIVE WITH FOOD -- absorption is meaningfully enhanced by food, unlike most other oral cephalosporins here. Shake well; REFRIGERATE, discard after 14 days.",
    notes: "",
  },
  {
    id: "cephalexin",
    name: "Cephalexin",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    doseOptions: [
      { id: "young", label: "2-24 months: 50-100mg/kg/day \u00f74 doses", low: 50, high: 100, freq: 4, maxDay: 4000, singleDoseMax: 500 },
      { id: "older", label: ">24 months: 25-50mg/kg/day \u00f74 doses", low: 25, high: 50, freq: 4, maxDay: 4000, singleDoseMax: 500 },
      { id: "severe-any-age", label: "Severe infection, any age: 50-100mg/kg/day \u00f74 doses", low: 50, high: 100, freq: 4, maxDay: 4000, singleDoseMax: 500 },
      { id: "pharyngitis", label: "Streptococcal pharyngitis (\u00f7BID)", low: 40, high: 40, freq: 2, maxDay: 4000, singleDoseMax: 1000 },
    ],
    sourceNote: "Restructured per the age/weight cutoffs document (Veauthier & Miller, 2020): dosing is genuinely age-banded for standard infections -- 2-24 month-olds get a HIGHER mg/kg/day range than older children -- and each dose is capped at 500mg regardless of the calculated total. Added back a 'Severe infection, any age' option from this project's original admin-notes reference, which gives the same 50-100mg/kg/day range independent of age for severe disease -- use that option rather than the age-band ones if severity, not age, is driving the higher dose.",
    defaultDurationDays: 7,
    brands: [
      { name: "Sporidex Redimix", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 125 }, { mgPer5ml: 250, displayLabel: "250mg/5mL (Sporidex Redimix 250)" }, { mgPerMl: 100, displayLabel: "100mg/mL drops" }, { tabletMg: 500, displayLabel: "500mg capsule" }] },
    ],
    adminNote: "With or without food; give with food if GI upset occurs. Shake well; REFRIGERATE, discard after 14 days.",
    notes: "",
  },
  {
    id: "azithromycin",
    name: "Azithromycin",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    doseOptions: [
      { id: "day1", label: "Day 1 (then 5mg/kg days 2-5)", low: 10, high: 10, freq: 1, maxDay: 500, singleCourse: true },
      { id: "day2to5", label: "Days 2-5", low: 5, high: 5, freq: 1, maxDay: 250, singleCourse: true },
      { id: "gas-aom", label: "Alt. GAS/AOM: 12mg/kg once daily x5 days", low: 12, high: 12, freq: 1, maxDay: 500 },
      { id: "alt3day", label: "Alternative: 10mg/kg/day \u00d73 days", low: 10, high: 10, freq: 1, maxDay: 500 },
      { id: "enteric", label: "Enteric fever (typhoid): 20mg/kg/day once daily x7-14 days", low: 20, high: 20, freq: 1, maxDay: 1000 },
      { id: "cholera", label: "Cholera: 20mg/kg single dose (avoid <6mo)", low: 20, high: 20, freq: 1, maxDay: 1000, singleCourse: true },
    ],
    sourceNote: "CORRECTION: the Enteric fever and Cholera options (sourced from Meherban Singh in an earlier pass of this project) were dropped when this app was rebuilt around the newer admin-notes reference. Restored here. The 'Alt. GAS/AOM' 12mg/kg option is new -- from the age/weight cutoffs document (Sur & Plesa, Am Fam Physician, 2022), a different once-daily regimen than the classic 10mg/5mg taper above it.",
    defaultDurationDays: 5,
    brands: [
      { name: "Azee Rediuse 200", manufacturer: "Cipla", strengths: [{ mgPer5ml: 200 }, { tabletMg: 250, displayLabel: "250mg tablet" }, { tabletMg: 500, displayLabel: "500mg tablet" }] },
      { name: "Azee Rediuse 100", manufacturer: "Cipla", strengths: [{ mgPer5ml: 100 }] },
    ],
    adminNote: "May be given with or without food (food improves suspension tolerability). Shake well; give as a SINGLE daily dose, ideally the same time each day. Do NOT co-administer within 2h of aluminium/magnesium antacids.",
    notes: "Store 5-30\u00b0C (fridge or room temp both fine), discard after 10 days -- more flexible than amoxiclav or cefpodoxime.",
  },
  {
    id: "clarithromycin",
    name: "Clarithromycin",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists clarithromycin among agents where age cutoffs were not found in its retrieved sources -- the 15mg/kg/day dose is still reasonably sourced from elsewhere, but verify the minimum age against the dispensed product label.",
    doseOptions: [
      { id: "standard", label: "Standard (\u00f7Q12h)", low: 15, high: 15, freq: 2, maxDay: 1000 },
    ],
    defaultDurationDays: 7,
    brands: [
      { name: "Claribid", manufacturer: "Abbott", strengths: [{ mgPer5ml: 125 }, { mgPer5ml: 250, displayLabel: "250mg/5mL (Claribid 250 DS)" }, { tabletMg: 250, displayLabel: "250mg tablet" }, { tabletMg: 500, displayLabel: "500mg tablet" }] },
    ],
    adminNote: "With or without food. DO NOT REFRIGERATE the suspension -- cold thickens/gels it and worsens the already poor palatability. Shake well.",
    notes: "Explicitly tell parents \"keep at room temperature, do not put in the fridge\" -- they often refrigerate all antibiotics by default, and this is the one common suspension here where that's actively wrong.",
  },
  {
    id: "cotrimoxazole",
    name: "Co-trimoxazole (Trimethoprim-Sulfamethoxazole)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 2,
    doseOptions: [
      { id: "uti", label: "UTI (TMP component, \u00f7Q12h)", low: 6, high: 12, freq: 2, maxDay: 320 },
      { id: "pjp", label: "PJP prophylaxis (TMP component, once daily)", low: 5, high: 5, freq: 1, maxDay: 320 },
    ],
    sourceNote: "Confirmed against the age/weight cutoffs document: 2mo floor (avoid <2mo) and the 6-12mg TMP/kg/day figure both match its 2-24mo band exactly. That source's 160mg TMP/dose cap is already satisfied by this app's existing 320mg/day ceiling divided across the 2 daily doses -- no change needed. It gives no separate figure for >24mo, so this app continues using the same 6-12mg/kg/day range for older children rather than inventing a second band.",
    defaultDurationDays: 7,
    brands: [
      { name: "Bactrim", manufacturer: "Abbott", strengths: [{ mgPer5ml: 40, displayLabel: "TMP 40mg + SMX 200mg /5mL" }, { tabletMg: 160, displayLabel: "Bactrim-DS tablet, TMP 160mg + SMX 800mg (adult-strength -- adolescent/large child use only, not divisible for small children)" }] },
    ],
    adminNote: "Give with a FULL GLASS of water/fluids to maintain hydration and reduce crystalluria risk. With or without food.",
    notes: "Dose is based on the TMP component. Ready-made solution, room temperature 20-25\u00b0C, protect from light -- no reconstitution needed.",
  },
  {
    id: "ofloxacin",
    name: "Ofloxacin",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists ofloxacin among agents where age cutoffs were not found in its retrieved sources -- verify against the dispensed product label. This is separate from and does not change the reserved-use precaution below.",
    doseOptions: [
      { id: "standard", label: "Reserved use only (complicated/GI/UTI, no alternative)", low: 15, high: 15, freq: 1, maxDay: 800 },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Oflox Rediuse", manufacturer: "Cipla", strengths: [{ mgPer5ml: 100 }, { mgPer5ml: 50, displayLabel: "50mg/5mL (lower strength also stocked)" }, { tabletMg: 200, displayLabel: "200mg tablet" }, { tabletMg: 400, displayLabel: "400mg tablet" }] },
    ],
    adminNote: "As directed for the specific indication.",
    precaution: "Systemic fluoroquinolone \u2014 RESERVED for specific indications where no alternative exists (arthropathy risk in growing children). This is genuinely restricted use, not a routine first/second-line choice.",
    notes: "",
  },
  {
    id: "linezolid",
    name: "Linezolid",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists linezolid among agents where age cutoffs were not found in its retrieved sources -- verify against the dispensed product label.",
    doseOptions: [
      { id: "under12", label: "<12 years (\u00f7Q8h)", low: 30, high: 30, freq: 3, maxDay: 1800 },
      { id: "over12", label: "\u226512 years (\u00f7Q12h, max 600mg/dose)", low: 20, high: 20, freq: 2, maxDay: 1200, singleDoseMax: 600 },
    ],
    defaultDurationDays: 10,
    brands: [
      { name: "Lizoforce", manufacturer: "Mankind", strengths: [{ mgPer5ml: 100 }] },
    ],
    adminNote: "With or without food. Shake GENTLY, avoid vigorous shaking. Observe tyramine/serotonergic drug interaction cautions (this is a weak MAOI).",
    precaution: "Reserved for resistant Gram-positive infections (MRSA, VRE) \u2014 specialist-level antibiotic, not routine OPD first-line.",
    notes: "Room temperature once constituted; do not refrigerate; use within 21 days.",
  },
  {
    id: "ciprofloxacin-systemic",
    name: "Ciprofloxacin (systemic, oral)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 12,
    sourceNote: "ADDED FROM THE HOSPITAL FORMULARY -- this drug is not in either uploaded dosing reference. Dose (20-30mg/kg/day divided q12h, max 750mg/dose) is the standard pediatric fluoroquinolone convention; verify against your reference. 1-year floor reflects the FDA-labeled pediatric indications (complicated UTI/pyelonephritis).",
    doseOptions: [
      { id: "standard", label: "Reserved use only (\u00f7Q12h)", low: 20, high: 30, freq: 2, maxDay: 1500, singleDoseMax: 750 },
    ],
    defaultDurationDays: 10,
    brands: [
      { name: "Ciplox", manufacturer: "Cipla", strengths: [{ tabletMg: 500, displayLabel: "500mg tablet -- adult-strength; no pediatric suspension in the OPD formulary, so small children cannot be dosed accurately" }] },
    ],
    adminNote: "Swallow with fluids; keep the child well hydrated. Separate from antacids, calcium, iron and zinc by at least 2h before / 6h after.",
    precaution: "Systemic fluoroquinolone \u2014 RESERVED for indications with no safe alternative (arthropathy/tendon risk in growing children). Not a routine first- or second-line choice.",
    notes: "",
  },
  {
    id: "moxifloxacin-systemic",
    name: "Moxifloxacin (systemic, oral)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    topicalOnly: true,
    sig: "NOT AUTO-CALCULATED \u2014 no routine pediatric OPD dose; specialist-directed use only (e.g. resistant TB regimens)",
    brands: [{ name: "Moxicip (tablet)", manufacturer: "Cipla", strengths: [{ displayLabel: "400mg tablet -- adult/adolescent strength" }] }],
    precaution: "Systemic fluoroquinolone with limited pediatric data. This entry exists so the drug isn't silently missing from the pharmacy list \u2014 neither uploaded reference gives a dose, so none is calculated here. The eye-drop form is listed separately under ENT / Ophthalmic.",
    notes: "",
  },
  {
    id: "levofloxacin",
    name: "Levofloxacin",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 6,
    sourceNote: "ADDED FROM THE HOSPITAL FORMULARY -- not in either uploaded dosing reference. Doses (6mo-<5yr: 10mg/kg q12h; \u22655yr: 10mg/kg once daily, max 750mg/day) are the standard AAP/Harriet Lane-style pediatric convention; verify against your reference. Pick the age-appropriate option below \u2014 it is not selected automatically.",
    doseOptions: [
      { id: "under5", label: "6 mo to <5 yr: 10mg/kg/dose \u00f7Q12h (20mg/kg/day)", low: 20, high: 20, freq: 2, maxDay: 1500, singleDoseMax: 750 },
      { id: "over5", label: "\u22655 yr: 10mg/kg once daily (max 750mg)", low: 10, high: 10, freq: 1, maxDay: 750 },
    ],
    defaultDurationDays: 7,
    brands: [
      { name: "Levoflox", manufacturer: "Cipla", strengths: [{ tabletMg: 500, displayLabel: "500mg tablet -- adult-strength; no pediatric liquid in the OPD formulary" }] },
    ],
    adminNote: "With or without food; swallow with fluids. Separate from antacids, calcium, iron and zinc by at least 2h.",
    precaution: "Systemic fluoroquinolone \u2014 RESERVED for indications with no safe alternative (arthropathy/tendon risk in growing children), e.g. resistant respiratory or TB-related use under specialist direction.",
    notes: "",
  },
  {
    id: "albendazole",
    name: "Albendazole (\u00b1 Ivermectin)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 12,
    ageBased: true,
    ageBands: [
      { minMonths: 12, maxMonths: 23, label: "1-2 years: 200mg single dose", freqText: "single dose" },
      { minMonths: 24, maxMonths: 999, label: "\u22652 years: 400mg single dose", freqText: "single dose" },
    ],
    sourceNote: "The age/weight cutoffs document lists albendazole's age cutoff as 'not in retrieved sources' for that specific compilation -- but this app's 12-23mo/\u226524mo bands are directly confirmed against Meherban Singh's text (verified in an earlier pass of this project), so despite that document's gap, this dosing has solid sourcing.",
    defaultDurationDays: 1,
    brands: [
      { name: "Bandy", manufacturer: "Mankind", strengths: [{ mgPer5ml: 200 }] },
      { name: "Bandy Plus (+Ivermectin)", manufacturer: "Mankind", strengths: [{ mgPer5ml: 200, displayLabel: "200mg/5mL + Ivermectin -- confirm exact ivermectin concentration per 5mL on the label before dosing that component" }, { tabletMg: 400, displayLabel: "400mg tablet + Ivermectin 6mg" }] },
      { name: "Zentel", manufacturer: "GSK", strengths: [{ tabletMg: 400, displayLabel: "400mg tablet" }] },
    ],
    adminNote: "GIVE WITH A FATTY MEAL to increase absorption for tissue infections (strongyloides/cysticercosis). Single-dose deworming can be with or without food. For strongyloides/cysticercosis, the same dose is typically given over a 3-day course -- adjust duration manually rather than relying on this row's single-dose default.",
    notes: "Bandy Plus adds ivermectin (~200mcg/kg), typically restricted to \u226515kg/>5yr per program guidance -- verify weight/age before using the combination product.",
  },
  {
    id: "fosfomycin",
    name: "Fosfomycin Trometamol",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 144,
    doseOptions: [
      { id: "standard", label: "Adolescents/\u226512yr, single dose", low: 3000, high: 3000, freq: 1, maxDay: 3000, isDirectMgOption: true },
    ],
    defaultDurationDays: 1,
    brands: [
      { name: "Novefos", manufacturer: "Sun Pharma", strengths: [{ tabletMg: 3000, displayLabel: "3g sachet" }] },
    ],
    adminNote: "Dissolve the sachet in ~90-120mL COOL water (not hot), take immediately, on an EMPTY STOMACH ideally at bedtime after emptying the bladder.",
    precaution: "Limited data below 12 years \u2014 this is realistically an adolescent/adult product for uncomplicated cystitis.",
    notes: "",
  },
  {
    id: "oseltamivir",
    name: "Oseltamivir",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    weightBandTable: true,
    weightBandFreqPerDay: 2,
    weightBandShowDuration: true,
    ageBandsUnder1: [
      { minMonths: 0.5, maxMonths: 11, doseMg: null, isPerKg: true, mgPerKg: 3, freq: 2, label: "2wk-<1yr: 3mg/kg BID x5 days" },
    ],
    weightBands: [
      { maxKg: 15, mg: 30, label: "\u226415kg: 30mg BID x5 days" },
      { maxKg: 23, mg: 45, label: ">15-23kg: 45mg BID x5 days" },
      { maxKg: 40, mg: 60, label: ">23-40kg: 60mg BID x5 days" },
      { maxKg: 999, mg: 75, label: ">40kg: 75mg BID x5 days" },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Antiflu", manufacturer: "Cipla", strengths: [{ mgPerMl: 12, displayLabel: "12mg/mL suspension" }, { tabletMg: 75, displayLabel: "75mg capsule" }] },
    ],
    adminNote: "START WITHIN 48H of symptom onset for maximum benefit. With or without food -- tolerability improves if given WITH food. Shake suspension; use the enclosed measuring device (mL, not household spoon).",
    sourceNote: "Confirmed against the age/weight cutoffs document: FDA treatment floor is 2 weeks (matches the 'ageBandsUnder1' band above); AAP/CDC additionally support use from birth including preterm infants, off-label. IMPORTANT: prophylaxis is NOT established under 1 year -- the 'same dose once daily' prophylaxis note below applies to the \u22651yr weight-band regimen only, not to the <1yr age-band dose. Unlike Ondansetron and Esomeprazole elsewhere in this app, oseltamivir does NOT get a dual weight-band/mg-kg toggle -- checked specifically, and every source used in this project doses it exclusively by discrete weight band, with no continuous mg/kg formula given anywhere. A toggle here would mean inventing a number rather than citing one.",
    notes: "Prophylaxis = same weight-band dose given ONCE daily instead of BID, for children \u22651 year only. Storage: fridge preferred (up to 17 days) or room temp (10 days) -- confirm against this specific product's label, as labeling varies between oseltamivir brands.",
  },
  {
    id: "metronidazole",
    name: "Metronidazole (oral)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    doseOptions: [
      { id: "giardia", label: "Giardiasis: 15mg/kg/day \u00f7TID x5-7 days", low: 15, high: 15, freq: 3, maxDay: 750, singleDoseMax: 250 },
      { id: "amebiasis", label: "Amebiasis: 35-50mg/kg/day \u00f7TID x7-10 days", low: 35, high: 50, freq: 3, maxDay: 2250 },
      { id: "anaerobic", label: "Anaerobic infection: 30mg/kg/day \u00f7Q6h x7-10 days", low: 30, high: 30, freq: 4, maxDay: 4000, singleDoseMax: 500 },
      { id: "cdiff", label: "C. difficile (nonsevere): 7.5mg/kg/dose (max 500mg) TID-QID x10 days", low: 30, high: 30, freq: 4, maxDay: 2000, singleDoseMax: 500 },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Amebiasis pediatric 35-50mg/kg/day \u00f7TID (max 2,250mg/day) and anaerobic 30mg/kg/day \u00f7q6h (max 4g/day) per the FDA metronidazole/Flagyl labels. Giardiasis 15mg/kg/day \u00f7TID x5-7 days (not FDA-approved for this indication but the most widely used therapy; 80-100% efficacy per AAP Red Book 2024-2027); tinidazole or nitazoxanide are better-tolerated single-/short-course alternatives. C. difficile nonsevere 7.5mg/kg/dose (max 500mg) TID-QID x10 days per IDSA/SHEA via Shirley et al., Pediatrics, 2023 \u2014 oral vancomycin is now often preferred over metronidazole for CDI.",
    defaultDurationDays: 7,
    brands: [
      { name: "Metrogyl", manufacturer: "JB Pharma", strengths: [{ mgPer5ml: 100, displayLabel: "100mg/5mL (benzoate) suspension" }, { tabletMg: 200, displayLabel: "200mg tablet" }, { tabletMg: 400, displayLabel: "400mg tablet" }] },
      { name: "Flagyl", manufacturer: "Abbott", strengths: [{ mgPer5ml: 200, displayLabel: "200mg/5mL suspension \u2014 verify strength on pack" }, { tabletMg: 400, displayLabel: "400mg tablet" }] },
    ],
    adminNote: "Give WITH or AFTER food to reduce GI upset and metallic taste. Complete the full course. STRICTLY AVOID ALCOHOL (incl. alcohol-containing syrups/mouthwashes) during and for 48h after \u2014 disulfiram-like reaction. The suspension (benzoate ester) is less bitter but confirm the mg/kg math against the exact labeled strength.",
    precaution: "Reduce dose by 50% in severe (Child-Pugh C) hepatic impairment. Peripheral neuropathy with prolonged/repeated courses.",
    notes: "",
  },
  {
    id: "acyclovir",
    name: "Acyclovir (oral)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 24,
    doseOptions: [
      { id: "varicella", label: "Chickenpox (varicella): 20mg/kg/dose QID (max 800mg/dose) x5 days", low: 80, high: 80, freq: 4, maxDay: 3200, singleDoseMax: 800 },
      { id: "hsv-gingivo", label: "HSV gingivostomatitis (mild): 20mg/kg/dose QID (max 400mg/dose) x7-10 days", low: 80, high: 80, freq: 4, maxDay: 1600, singleDoseMax: 400 },
      { id: "hsv-recurrent", label: "Recurrent herpes labialis: 20mg/kg/dose QID (max 400mg/dose) x5 days", low: 80, high: 80, freq: 4, maxDay: 1600, singleDoseMax: 400 },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Chickenpox: 20mg/kg/dose QID (80mg/kg/day, max 3,200mg/day), children \u22652 years, x5 days \u2014 most effective started within 24h of rash; children >40kg take the adult 800mg QID dose (FDA acyclovir label). HSV gingivostomatitis (mild, off-label) and recurrent herpes labialis: 20mg/kg/dose (max 400mg/dose) QID per the pediatric OI guideline (Avira-Arill et al., 2026). SEVERE/disseminated/encephalitis/neonatal HSV requires IV acyclovir \u2014 not this oral entry. The 2-year floor matches the varicella trial/label population; oral bioavailability is poor (valacyclovir is better absorbed where a swallow-capable child allows).",
    defaultDurationDays: 5,
    brands: [
      { name: "Acivir", manufacturer: "Cipla", strengths: [{ mgPer5ml: 200, displayLabel: "200mg/5mL suspension" }, { tabletMg: 200, displayLabel: "200mg DT" }, { tabletMg: 400, displayLabel: "400mg tablet" }, { tabletMg: 800, displayLabel: "800mg tablet" }] },
      { name: "Zovirax", manufacturer: "GSK", strengths: [{ tabletMg: 200, displayLabel: "200mg tablet" }, { tabletMg: 400, displayLabel: "400mg tablet" }] },
    ],
    adminNote: "With or without food; MAINTAIN GOOD HYDRATION throughout (crystalluria/renal risk if volume-depleted). Space the 4 daily doses evenly while awake. Start as early as possible \u2014 within 24h of varicella rash for benefit.",
    precaution: "Dose-reduce in renal impairment (adjust by creatinine clearance). Oral acyclovir is for mild/immunocompetent disease only \u2014 escalate to IV for severe, disseminated, CNS, neonatal, or immunocompromised HSV/VZV.",
    notes: "",
  },
  {
    id: "nystatin-oral",
    name: "Nystatin (oral suspension, oral thrush)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    topicalOnly: true,
    minAgeMonths: 0,
    sig: "ORAL CANDIDIASIS (first-line, immunocompetent). 100,000 U/mL suspension: Neonate <1 month = 1mL QID x5-10 days; infant 1-11 months = 2mL QID x7-14 days; child \u226512 months = 4-6mL QID (max 2.4 million U/day) x7-14 days. Continue 48h after lesions resolve.",
    brands: [
      { name: "Mycostatin / Nystatin oral suspension", manufacturer: "Various", strengths: [{ displayLabel: "100,000 U/mL oral suspension" }] },
    ],
    adminNote: "Give AFTER feeds; do NOT feed for 5-10 min afterwards. Paint/swab onto the mucosa with gauze or a cotton applicator; for neonates/infants split each dose into two, one per cheek. If the child can swish, hold in the mouth as long as possible then swallow. Not systemically absorbed \u2014 acts topically in the mouth. Sterilize bottle nipples/pacifiers before each use to prevent reinfection. High sucrose content \u2014 relevant with chronic use (caries).",
    precaution: "For widespread/refractory disease, immunosuppression, or topical failure, switch to oral fluconazole (separate entry) \u2014 fluconazole has higher clinical and mycological cure than nystatin in immunocompromised children.",
    notes: "",
  },
  {
    id: "fluconazole",
    name: "Fluconazole (oral, candidiasis)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 6,
    doseOptions: [
      { id: "opc", label: "Oropharyngeal candidiasis: 6mg/kg day 1, then 3mg/kg once daily x\u226514 days", low: 3, high: 6, freq: 1, maxDay: 200 },
      { id: "esophageal", label: "Esophageal candidiasis: 6mg/kg day 1, then 3-12mg/kg once daily x\u226521 days", low: 3, high: 12, freq: 1, maxDay: 400 },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Oropharyngeal candidiasis \u22656 months: 6mg/kg on day 1 (loading), then 3mg/kg once daily for \u226514 days (FDA fluconazole oral-suspension label; Downes et al., Paediatr Drugs, 2020). Esophageal: 6mg/kg day 1 then 3mg/kg once daily, up to 12mg/kg/day by response, \u226521 days and \u22652 weeks past symptom resolution. The slider shows the MAINTENANCE 3mg/kg once-daily figure \u2014 give the 6mg/kg loading dose on day 1 separately (see admin note). Neonates (<1 month) dose differently (loading 25mg/kg then 12mg/kg/day for invasive disease) \u2014 not covered by this \u22656-month entry.",
    defaultDurationDays: 14,
    brands: [
      { name: "Zocon", manufacturer: "FDC", strengths: [{ mgPer5ml: 50, displayLabel: "50mg/5mL suspension" }, { tabletMg: 50, displayLabel: "50mg tablet" }, { tabletMg: 150, displayLabel: "150mg tablet" }] },
      { name: "Forcan", manufacturer: "Cipla", strengths: [{ tabletMg: 50, displayLabel: "50mg tablet" }, { tabletMg: 150, displayLabel: "150mg tablet" }] },
    ],
    adminNote: "GIVE THE 6mg/kg LOADING DOSE ON DAY 1, then 3mg/kg once daily from day 2 \u2014 the calculator shows the maintenance dose, so double it for the first dose. With or without food, same time each day. Treat for at least 2 weeks (OPC) / 3 weeks and \u22652 weeks past symptom resolution (esophageal).",
    precaution: "QT-prolongation risk and many CYP interactions (hepatically cleared drugs) \u2014 review co-medications. Monitor LFTs with prolonged use.",
    notes: "",
  },
  {
    id: "mebendazole",
    name: "Mebendazole",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 12,
    doseOptions: [
      { id: "pinworm", label: "Pinworm (enterobiasis): 100mg once, REPEAT in 2 weeks", low: 100, high: 100, freq: 1, maxDay: 100, isDirectMgOption: true, singleCourse: true },
      { id: "sti-3day", label: "Ascaris/hookworm/whipworm: 100mg BID x3 days", low: 100, high: 100, freq: 2, maxDay: 200, isDirectMgOption: true },
      { id: "single-500", label: "Ascaris/hookworm (alternative): 500mg ONCE", low: 500, high: 500, freq: 1, maxDay: 500, isDirectMgOption: true, singleCourse: true },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Fixed (not weight-based) dosing per Sanchez-Vegas & Villavicencio, Pediatrics in Review, 2022 and the FDA Vermox label: pinworm 100mg once then repeat in 2 weeks; roundworm/hookworm/whipworm 100mg BID x3 days OR 500mg once. Safety/effectiveness NOT established below 1 year (convulsions reported in infants) \u2014 hence the 12-month floor. Albendazole (already in the app) is an equivalent benzimidazole alternative.",
    defaultDurationDays: 3,
    brands: [
      { name: "Mebex", manufacturer: "Cipla", strengths: [{ mgPer5ml: 100, displayLabel: "100mg/5mL suspension" }, { tabletMg: 100, displayLabel: "100mg chewable tablet" }] },
    ],
    adminNote: "May be taken with or without food (fatty food increases absorption for tissue helminths). CHEW tablets fully or crush for young children. For pinworm, treat the whole household and repeat the dose in 2 weeks to catch re-hatching; emphasise hand/nail hygiene and laundering bedding.",
    notes: "",
  },
  {
    id: "pyrantel",
    name: "Pyrantel Pamoate",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 12,
    doseOptions: [
      { id: "pinworm", label: "Pinworm: 11mg/kg ONCE (max 1g), REPEAT in 2 weeks", low: 11, high: 11, freq: 1, maxDay: 1000, singleDoseMax: 1000, singleCourse: true },
      { id: "ascaris", label: "Ascaris/hookworm: 11mg/kg once daily (max 1g) x3 days", low: 11, high: 11, freq: 1, maxDay: 1000, singleDoseMax: 1000 },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. 11mg/kg (max 1g) \u2014 single dose repeated in 2 weeks for pinworm, or once daily x3 days for roundworm/hookworm (Sanchez-Vegas & Villavicencio, Pediatrics in Review, 2022; WHO essential-medicines list). A depolarising neuromuscular agent (worm paralysis) \u2014 do NOT combine with piperazine (antagonistic). Safety not formally established in children; used >1 year in preventive-chemotherapy programmes.",
    defaultDurationDays: 1,
    brands: [
      { name: "Nemocid", manufacturer: "Ipca", strengths: [{ mgPer5ml: 250, displayLabel: "250mg/5mL suspension" }, { tabletMg: 250, displayLabel: "250mg tablet" }] },
    ],
    adminNote: "With or without food; may mix suspension with milk/juice. For pinworm, treat the household and repeat in 2 weeks. An OTC alternative to mebendazole/albendazole where those are unavailable.",
    notes: "",
  },
  {
    id: "griseofulvin",
    name: "Griseofulvin (oral, tinea capitis)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 24,
    doseOptions: [
      { id: "tinea-capitis", label: "Tinea capitis (microsize): 20-25mg/kg once daily (max 1g) x6-8 weeks", low: 20, high: 25, freq: 1, maxDay: 1000 },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Microsize griseofulvin 20-25mg/kg/day (max 1g) once daily for \u22656-8 weeks (or 2 weeks past clinical+mycological cure) \u2014 oral therapy is MANDATORY for tinea capitis because topical antifungals cannot penetrate the hair shaft. Preferred over terbinafine for Microsporum spp.; terbinafine is superior for Trichophyton spp. (Gupta & Drummond-Main, Pediatr Dermatol, 2012). Dose figure is the microsize formulation \u2014 ultramicrosize uses a lower mg/kg; verify which the pack contains.",
    defaultDurationDays: 42,
    brands: [
      { name: "Grisovin FP", manufacturer: "GSK", strengths: [{ tabletMg: 125, displayLabel: "125mg tablet (microsize)" }, { tabletMg: 250, displayLabel: "250mg tablet (microsize)" }] },
    ],
    adminNote: "GIVE WITH A FATTY MEAL (e.g. milk, yoghurt) \u2014 substantially improves absorption. Counsel photosensitivity. Long course \u2014 reinforce adherence; treat/clip asymptomatic carriers and use an adjunctive antifungal shampoo (e.g. ketoconazole/selenium sulfide) to reduce spore shedding.",
    precaution: "Hepatically metabolised, CYP inducer (reduces efficacy of warfarin and hormonal contraceptives). Avoid in hepatic disease, porphyria, and pregnancy. Consider baseline/periodic LFTs for prolonged courses.",
    notes: "",
  },
  {
    id: "terbinafine",
    name: "Terbinafine (oral, tinea capitis)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 24,
    weightBandTable: true,
    weightBandFreqPerDay: 1,
    weightBandShowDuration: true,
    weightBands: [
      { maxKg: 20, mg: 62.5, label: "<20kg: 62.5mg once daily" },
      { maxKg: 40, mg: 125, label: "20-40kg: 125mg once daily" },
      { maxKg: 999, mg: 250, label: ">40kg: 250mg once daily" },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. Weight-banded tinea capitis dosing: <20kg 62.5mg, 20-40kg 125mg, >40kg 250mg once daily for 4-6 weeks (Gupta & Drummond-Main, Pediatr Dermatol, 2012). Terbinafine is SUPERIOR to griseofulvin for Trichophyton spp. (the commonest cause) at a lower dose and shorter course; griseofulvin is preferred for Microsporum spp. The 62.5mg band = half of a 125mg tablet.",
    defaultDurationDays: 42,
    brands: [
      { name: "Terbinaforce", manufacturer: "Mankind", strengths: [{ tabletMg: 125, displayLabel: "125mg tablet (splittable to 62.5mg)" }, { tabletMg: 250, displayLabel: "250mg tablet" }] },
      { name: "Daskil", manufacturer: "Micro Labs", strengths: [{ tabletMg: 250, displayLabel: "250mg tablet" }] },
    ],
    adminNote: "With or without food. Long course \u2014 reinforce adherence; pair with an antifungal shampoo to reduce spore shedding and treat carriers. Confirm the dermatophyte genus where possible, since it determines the better drug.",
    precaution: "Hepatotoxicity (rare) \u2014 consider baseline LFTs and avoid in active/chronic liver disease; taste disturbance can occur. Fewer drug interactions than griseofulvin.",
    notes: "",
  },
  {
    id: "artemether-lumefantrine",
    name: "Artemether-Lumefantrine (uncomplicated falciparum malaria)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    topicalOnly: true,
    minAgeMonths: 2,
    sig: "UNCOMPLICATED P. falciparum malaria, \u22652 months AND \u22655kg. 20/120mg tablets, 6 doses over 3 days (0h, 8h, then BID mornings+evenings on days 2 and 3), by weight: 5-<15kg = 1 tab/dose (6 total); 15-<25kg = 2 tabs/dose (12 total); 25-<35kg = 3 tabs/dose (18 total); \u226535kg = 4 tabs/dose (24 total). NOT for severe/complicated malaria (that needs parenteral artesunate).",
    brands: [
      { name: "Coartem / Coartem Dispersible", manufacturer: "Novartis", strengths: [{ displayLabel: "Artemether 20mg + Lumefantrine 120mg tablet (dispersible cherry-flavoured paediatric form available)" }] },
      { name: "Lumether / Falcynil-LF", manufacturer: "Various", strengths: [{ displayLabel: "Artemether 20mg + Lumefantrine 120mg \u2014 confirm exact strength; 80/480mg adult tablets also exist" }] },
    ],
    adminNote: "TAKE WITH FOOD containing fat (milk, breast milk, broth) \u2014 lumefantrine absorption is poor on an empty stomach and determines cure. Dispersible tablets dissolve in ~10mL water; may crush standard tablets into water. REPEAT the dose if vomiting occurs within 1-2h. Give the 2nd dose at 8h, then morning+evening on days 2-3 (complete all 6 doses even if better). Confirm the diagnosis parasitologically before treating where feasible.",
    precaution: "QT-prolongation risk \u2014 avoid with other QT-prolonging drugs and in known long-QT/significant cardiac disease. Not established <5kg or <2 months. Avoid in the first trimester of pregnancy unless no alternative (use quinine+clindamycin there).",
    notes: "A WHO first-line artemisinin-based combination for uncomplicated falciparum malaria; endemic across much of India.",
  },
  {
    id: "penicillin-v",
    name: "Penicillin V (streptococcal pharyngitis)",
    category: "Antibiotics / Antivirals / Antiparasitics",
    minAgeMonths: 0,
    weightBandTable: true,
    weightBandShowDuration: true,
    doseOptions: [
      { id: "tid", label: "TID (3x daily)", freq: 3 },
      { id: "bid", label: "BID (2x daily)", freq: 2 },
    ],
    weightBands: [
      { maxKg: 27, mg: 250, label: "<27kg: 250mg (400,000 U)" },
      { maxKg: 999, mg: 500, label: "\u226527kg: 500mg (800,000 U)" },
    ],
    sourceNote: "ADDED AGENT \u2014 not in the uploaded formulary; confirm brand/strength on the shelf. First-line for GAS pharyngitis (AAP Red Book 2024-2027; IDSA/AHA): <27kg 250mg, \u226527kg 500mg, given 2-3 times daily for a FULL 10 days to prevent rheumatic fever. Select TID or BID preference. An alternative weight-based convention is 100,000 IU/kg/day \u00f73 (European tonsillitis guideline). Once-daily amoxicillin (already in the app) is a more palatable suspension and equally effective; penicillin V's advantage is its narrow spectrum.",
    defaultDurationDays: 10,
    brands: [
      { name: "Penicillin V potassium", manufacturer: "Various", strengths: [{ mgPer5ml: 125, displayLabel: "125mg (200,000 U)/5mL oral solution" }, { tabletMg: 250, displayLabel: "250mg (400,000 U) tablet" }, { tabletMg: 500, displayLabel: "500mg (800,000 U) tablet" }] },
    ],
    adminNote: "Give on an EMPTY STOMACH (1h before or 2h after food) for best absorption. Complete all 10 days even once well \u2014 short courses have inferior bacteriologic eradication and do not reliably prevent rheumatic fever. Suspension: refrigerate and discard per label.",
    precaution: "Contraindicated in type-I (immediate) penicillin hypersensitivity \u2014 use a first-generation cephalosporin (non-anaphylactic allergy) or a macrolide/clindamycin (anaphylactic allergy) instead.",
    notes: "Penicillin V is not widely stocked in Indian OPDs \u2014 confirm availability; amoxicillin is the usual practical first-line here.",
  },
  // ================= ANTIHISTAMINES =================
  {
    id: "cetirizine",
    name: "Cetirizine",
    category: "Antihistamines",
    minAgeMonths: 6,
    ageBased: true,
    ageBands: [
      { minMonths: 6, maxMonths: 23, label: "6-23 mo: 2.5mg once daily" },
      { minMonths: 24, maxMonths: 71, label: "2-5 yr: 2.5mg once or twice daily (max 5mg/day)" },
      { minMonths: 72, maxMonths: 143, label: "6-11 yr: 5-10mg once daily" },
      { minMonths: 144, maxMonths: 999, label: "\u226512 yr: 10mg once daily" },
    ],
    sourceNote: "Age floor lowered from 2 years to 6 months per the age/weight cutoffs document (FDA Children's Zyrtec label; Seidman et al., 2015) -- this is the prescription/labeled minimum. Note the separate OTC-specific instruction on that same label: 'under 2 years, ask a doctor' -- relevant if the family is buying it over the counter rather than on your script.",
    defaultDurationDays: 7,
    brands: [
      { name: "Cetzine", manufacturer: "Dr Reddy's", strengths: [{ mgPer5ml: 5 }] },
      { name: "Alerid", manufacturer: "Cipla", strengths: [{ mgPer5ml: 5 }] },
    ],
    adminNote: "Once daily, EVENING preferred (mild sedation possible). With or without food.",
    notes: "",
  },
  {
    id: "levocetirizine",
    name: "Levocetirizine",
    category: "Antihistamines",
    minAgeMonths: 24,
    ageBased: true,
    ageBands: [
      { minMonths: 24, maxMonths: 71, label: "2-5 yr: 1.25mg/day" },
      { minMonths: 72, maxMonths: 143, label: "6-11 yr: 2.5mg/day" },
      { minMonths: 144, maxMonths: 999, label: "\u226512 yr: 2.5-5mg/day" },
    ],
    sourceNote: "GENUINE CONFLICT between two sources: the age/weight cutoffs document gives an FDA-labeled floor of 6 months, but Meherban Singh (used elsewhere in this project) explicitly states 'avoid below 2 years.' This app uses the more conservative 2-year floor as the default gate -- if you specifically want to prescribe between 6-23 months on FDA labeling grounds, that's a deliberate decision to override this app's default, not something calculated here, since Claude does not have a specific mg figure sourced with confidence for that age band.",
    defaultDurationDays: 7,
    brands: [
      { name: "Xyzal", manufacturer: "Dr Reddy's", strengths: [{ mgPer5ml: 2.5 }, { tabletMg: 10, displayLabel: "10mg tablet -- note: this is 4x the usual pediatric per-dose amounts above; adolescent/adult-strength only" }] },
      { name: "Teczine", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 2.5 }, { tabletMg: 5, displayLabel: "5mg tablet" }] },
    ],
    adminNote: "Once daily, EVENING preferred (mild sedation possible). With or without food.",
    notes: "CORRECTION: Xyzal and Teczine tablet strengths were confirmed in the pharmacy formulary but missed during the earlier tablet-addition pass -- added now.",
  },
  {
    id: "fexofenadine",
    name: "Fexofenadine",
    category: "Antihistamines",
    minAgeMonths: 24,
    ageBased: true,
    ageBands: [
      { minMonths: 24, maxMonths: 143, label: "2-11 yr: 30mg BID" },
      { minMonths: 144, maxMonths: 999, label: "\u226512 yr: 60mg BID or 180mg once daily" },
    ],
    defaultDurationDays: 7,
    brands: [
      { name: "Allegra", manufacturer: "Sanofi", strengths: [{ mgPer5ml: 30 }] },
      { name: "Histafree", manufacturer: "Mankind", strengths: [{ mgPer5ml: 30 }] },
    ],
    adminNote: "Non-sedating -- can be given any time of day. Give with WATER, NOT fruit juice (juice reduces absorption significantly).",
    notes: "",
  },
  {
    id: "hydroxyzine",
    name: "Hydroxyzine",
    category: "Antihistamines",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Antipruritic / sedation (per dose)", low: 0.5, high: 0.5, freq: 4, maxDay: 100, isPerDose: true },
    ],
    defaultDurationDays: 7,
    brands: [
      { name: "Atarax syrup", manufacturer: "Dr Reddy's", strengths: [{ mgPer5ml: 10 }, { tabletMg: 10, displayLabel: "10mg tablet" }, { tabletMg: 25, displayLabel: "25mg tablet" }] },
      { name: "Atarax drops", manufacturer: "Dr Reddy's", strengths: [{ mgPerMl: 6 }] },
    ],
    adminNote: "SEDATING \u2014 give at BEDTIME for pruritus/night-time use. With or without food.",
    notes: "~0.5mg/kg/dose Q6-8h for antipruritic use; this is also used as a sedative/anxiolytic at similar doses.",
  },
  {
    id: "montelukast-combo",
    name: "Montelukast (as Levocetirizine or Bilastine combination)",
    category: "Antihistamines",
    minAgeMonths: 24,
    ageBased: true,
    ageBands: [
      { minMonths: 24, maxMonths: 71, label: "2-5 yr: 4mg once daily" },
      { minMonths: 72, maxMonths: 167, label: "6-14 yr: 5mg once daily" },
    ],
    defaultDurationDays: 30,
    brands: [
      { name: "Montair-LC Kid (+Levocetirizine 2.5mg)", manufacturer: "Cipla", strengths: [{ mgPer5ml: 4 }, { tabletMg: 4, displayLabel: "4mg tablet + Levocetirizine 2.5mg" }] },
      { name: "Montek-LC Kid (+Levocetirizine 2.5mg)", manufacturer: "Sun Pharma", strengths: [{ mgPer5ml: 4, displayLabel: "4mg/5mL syrup + Levocetirizine 2.5mg/5mL \u2014 verify exact concentration on the dispensed label" }, { tabletMg: 4, displayLabel: "4mg chewable tablet + Levocetirizine 2.5mg" }, { tabletMg: 5, displayLabel: "Montek-LC (adult/older-child strength): 5mg tablet + Levocetirizine 2.5mg \u2014 confirm this is the intended strength, not Montek-LC Kid" }] },
      { name: "Xyzal-M (+Levocetirizine 2.5mg)", manufacturer: "Dr Reddy's", strengths: [{ mgPer5ml: 4 }] },
    ],
    adminNote: "Once daily in the EVENING. Counsel the caregiver on montelukast's neuropsychiatric warning (mood/behavior/sleep changes) \u2014 this is a labeled warning, not a rare theoretical risk.",
    precaution: "Bilastine+Montelukast (Bilasure M Kid) uses a different antihistamine component not covered in this dosing reference \u2014 verify bilastine's pediatric dose separately before using that specific product; the montelukast figures above still apply to its montelukast component.",
    notes: "Levocetirizine component dosing: see the standalone Levocetirizine entry for that half of the combination.",
  },
  {
    id: "olopatadine",
    name: "Olopatadine (eye drops)",
    category: "Antihistamines",
    minAgeMonths: 36,
    topicalOnly: true,
    sig: "1 drop BID to affected eye(s), \u22653 years",
    brands: [{ name: "Olopat", manufacturer: "Ajanta", strengths: [{ displayLabel: "0.1% w/v eye drops" }] }],
    adminNote: "Wash hands; pull down lower lid, instill 1 drop into the conjunctival sac without touching the tip to the eye/lashes.",
  },
  {
    id: "intranasal-steroid",
    name: "Intranasal Corticosteroid (allergic rhinitis)",
    category: "Antihistamines",
    topicalOnly: true,
    minAgeMonths: 24,
    sig: "First-line for moderate/persistent allergic rhinitis. MOMETASONE (\u22652yr): 2-11yr 1 spray each nostril once daily; \u226512yr 2 sprays each nostril once daily. FLUTICASONE FUROATE (\u22652yr): 2-11yr 1 spray each nostril daily; \u226512yr 2 sprays each nostril daily. BUDESONIDE (\u22656yr): 6-11yr 1-2 sprays each nostril daily; \u226512yr 2 sprays each nostril daily. Each metered spray \u2248 50mcg.",
    brands: [
      { name: "Metaspray / Nasonex (Mometasone)", manufacturer: "Cipla / Organon", strengths: [{ displayLabel: "50mcg/actuation nasal spray \u2014 labeled \u22652 years" }] },
      { name: "Flomist / Sensimist (Fluticasone)", manufacturer: "Cipla / GSK", strengths: [{ displayLabel: "Fluticasone furoate 27.5mcg or propionate 50mcg/actuation \u2014 confirm which is stocked" }] },
      { name: "Rhinocort (Budesonide)", manufacturer: "AstraZeneca", strengths: [{ displayLabel: "Budesonide 64mcg/actuation \u2014 labeled \u22656 years" }] },
    ],
    adminNote: "Prime a new/unused bottle before first use. Tilt head slightly forward, aim the nozzle AWAY from the nasal septum (toward the outer wall) to reduce epistaxis and rare septal perforation; breathe in gently, do not sniff hard. Full benefit builds over several days to ~2 weeks \u2014 counsel regular daily use, not PRN. Wipe and recap the nozzle after use.",
    precaution: "Monitor growth velocity with prolonged continuous use; epistaxis and nasal dryness are the common local effects. Note: placed in the Antihistamines block because that is where this app groups allergic-rhinitis therapy; its route is Nasal (see ROUTE_OVERRIDES).",
    notes: "More effective than oral antihistamines or montelukast for nasal congestion in moderate/persistent allergic rhinitis.",
  },
  // ================= ANALGESICS / ANTIPYRETICS / STEROIDS =================
  {
    id: "paracetamol",
    name: "Paracetamol (Acetaminophen)",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 2,
    isPRN: true,
    doseOptions: [
      { id: "standard", label: "Standard (PRN Q4-6h, \u22644 doses/day)", lowDose: 10, highDose: 15, freqLabel: "PRN Q4-6h, max 4 doses/24h", maxDayPerKg: 60, maxDayAbsolute: 4000 },
    ],
    sourceNote: "Age floor updated to 2 months per the age/weight cutoffs document (Zempsky et al., Paediatr Drugs, 2023) -- this app previously had no floor at all. Max daily dose ceiling confirmed at 60mg/kg/day from that same source (BNF-C figure is 75mg/kg/day, noted for reference but not used as the default). CORRECTION: Crocin's own brand family (120/DS/drops/Advance) and Calpol's tablet forms were confirmed in the pharmacy formulary but missed during the earlier tablet-addition pass -- added now. Note the manufacturer split: Crocin is now under Haleon (GSK's consumer-health spinoff), not GSK directly, per the formulary.",
    defaultDurationDays: 3,
    brands: [
      { name: "Calpol", manufacturer: "GSK", strengths: [{ mgPer5ml: 120 }, { tabletMg: 500, displayLabel: "500mg tablet" }, { tabletMg: 650, displayLabel: "650mg tablet" }] },
      { name: "Calpol Ped Drops", manufacturer: "GSK", strengths: [{ mgPerMl: 100 }] },
      { name: "Paed Syrup Calpol", manufacturer: "GSK", strengths: [{ mgPer5ml: 250 }] },
      { name: "Crocin Max", manufacturer: "GSK", strengths: [{ mgPerMl: 100, displayLabel: "100mg/mL concentrated" }] },
      { name: "Crocin 120 / Crocin DS", manufacturer: "Haleon", strengths: [{ mgPer5ml: 120 }, { mgPer5ml: 240, displayLabel: "240mg/5mL (Crocin DS, higher strength)" }, { mgPerMl: 100, displayLabel: "100mg/mL drops" }, { tabletMg: 500, displayLabel: "500mg tablet (Crocin Advance)" }] },
      { name: "Babygesic (drops)", manufacturer: "Meyer", strengths: [{ mgPerMl: 100 }] },
    ],
    adminNote: "With or without food. NEVER exceed 4 doses/24h. Count ALL combination products containing paracetamol (Combiflam, Ibugesic Plus, Meftal-type combos) toward the same daily maximum. Measure drops vs syrup CAREFULLY \u2014 drops are far more concentrated per mL.",
    notes: "Max ~60mg/kg/day per this reference \u2014 more conservative than some other conventions; use this as the ceiling.",
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 6,
    isPRN: true,
    doseOptions: [
      { id: "standard", label: "Standard (PRN Q6-8h)", lowDose: 5, highDose: 10, freqLabel: "PRN Q6-8h", maxDayPerKg: 30, maxDayAbsolute: 2400 },
    ],
    sourceNote: "Age floor updated from 3 to 6 months per the age/weight cutoffs document (commonly \u22656 months across sources). Max daily dose ceiling changed from 40 to 30mg/kg/day per that same source (Zempsky et al., 2023) -- the 40mg/kg figure this app previously used is also a real cited ceiling elsewhere, so treat 30 as the conservative default rather than a hard consensus number.",
    defaultDurationDays: 3,
    brands: [
      { name: "Syrp Ibugesic", manufacturer: "Cipla", strengths: [{ mgPer5ml: 100 }] },
    ],
    adminNote: "Give WITH or AFTER food/milk to reduce GI upset. Ensure the child is well hydrated \u2014 AKI risk if dehydrated. Use caution in active varicella infection.",
    notes: "Max cited as ~30-40mg/kg/day in this reference (used 40 as the calculator ceiling, consistent with the upper end).",
  },
  {
    id: "ibuprofen-paracetamol",
    name: "Ibuprofen + Paracetamol (combination)",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 3,
    topicalOnly: true,
    sig: "Dose to individual components separately (Ibuprofen 100mg + Paracetamol 162.5mg per 5mL) \u2014 use the standalone Ibuprofen and Paracetamol entries to calculate each, then back-calculate the combined volume from this ratio",
    brands: [
      { name: "Combiflam", manufacturer: "Sanofi", strengths: [{ displayLabel: "Ibuprofen 100mg + Paracetamol 162.5mg /5mL" }] },
      { name: "Ibugesic Plus", manufacturer: "Cipla", strengths: [{ displayLabel: "Ibuprofen 100mg + Paracetamol 162.5mg /5mL" }] },
    ],
    adminNote: "Alternating or combined use of ibuprofen and paracetamol should be DELIBERATE, not accidental \u2014 dosing errors are common when families aren't clear which combination product contains which drug at what strength.",
    precaution: "CONFIRMED from Sanofi's official Combiflam package insert: no specific mg/kg dosing table is published at all \u2014 only 'consult a doctor if used beyond 3 days in children 6 months and older.' The manufacturer deliberately leaves weight-based dosing to the prescriber.",
    notes: "",
  },
  {
    id: "mefenamic",
    name: "Mefenamic Acid",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 6,
    sourceNote: "The age/weight cutoffs document explicitly flags mefenamic acid's age cutoff as unverified ('VERIFY LABEL') -- this app's 6-month floor is a general NSAID convention, not a confirmed label figure. Verify against the dispensed product before prescribing in a young infant.",
    isPRN: true,
    doseOptions: [
      { id: "standard", label: "Short-term fever/pain, PRN Q8h", lowDose: 6.5, highDose: 6.5, freqLabel: "PRN Q8h, short course only", maxDayPerKg: 20, maxDayAbsolute: 1500 },
    ],
    defaultDurationDays: 3,
    brands: [
      { name: "Meftal P", manufacturer: "Blue Cross", strengths: [{ mgPer5ml: 100 }] },
    ],
    adminNote: "Short course only \u2014 GI and renal risk with prolonged NSAID use in children.",
    notes: "This is mefenamic acid ALONE, not a paracetamol combination despite the 'P' in the brand name \u2014 confirmed from the exact composition in the pharmacy formulary.",
  },
  {
    id: "prednisolone",
    name: "Prednisolone Sodium Phosphate",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists prednisolone among agents where a specific age cutoff was not established in its retrieved sources -- the mg/kg dosing above is still reasonably sourced, but there is no confirmed minimum age floor beyond general pediatric use. Verify against the dispensed product label.",
    doseOptions: [
      { id: "standard", label: "Asthma exacerbation / croup / inflammatory, short course", low: 1, high: 2, freq: 2, maxDay: 60 },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Omnacortil Forte", manufacturer: "Macleods", strengths: [{ mgPer5ml: 15 }, { mgPer5ml: 5, displayLabel: "5mg/5mL (Omnacortil, lower-strength solution)" }, { mgPerMl: 5, displayLabel: "5mg/mL drops" }, { tabletMg: 5, displayLabel: "5mg dispersible tablet" }, { tabletMg: 10, displayLabel: "10mg dispersible tablet" }, { tabletMg: 20, displayLabel: "20mg dispersible tablet" }] },
    ],
    adminNote: "Give WITH FOOD, in the MORNING, as a short course. This formulation is chosen partly for palatability -- prednisolone is notably bitter.",
    notes: "For croup specifically, dexamethasone is often preferred over prednisolone per this reference -- worth considering if croup is the indication and dexamethasone is available.",
  },
  {
    id: "dexamethasone",
    name: "Dexamethasone (oral)",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 0,
    doseOptions: [
      { id: "croup", label: "Croup, SINGLE dose", low: 0.15, high: 0.6, freq: 1, maxDay: 16, singleCourse: true },
      { id: "asthma", label: "Asthma exacerbation, once daily (max 12mg)", low: 0.3, high: 0.6, freq: 1, maxDay: 12 },
    ],
    sourceNote: "Croup: 0.6mg/kg PO single dose is the established evidence-based standard (Gates et al., JAMA Pediatr, 2019); 0.15mg/kg is non-inferior for outpatient croup (Parker & Cooper, Pediatrics, 2019; Aregbesola et al., Cochrane, 2023), so 0.15-0.6mg/kg is the usable range \u2014 a single dose usually suffices. Asthma exacerbation: oral dexamethasone 0.3-0.6mg/kg (max 12mg), a 1-2 day course, is a GINA 2026 alternative to a prednisolone burst.",
    defaultDurationDays: 1,
    brands: [
      { name: "Dexona", manufacturer: "Zydus", strengths: [{ mgPer5ml: 0.5, displayLabel: "0.5mg/5mL \u2014 common Indian pediatric strength; VERIFY on the dispensed pack" }, { tabletMg: 0.5, displayLabel: "0.5mg tablet" }, { tabletMg: 4, displayLabel: "4mg tablet" }] },
      { name: "Decdan", manufacturer: "Merck", strengths: [{ mgPer5ml: 0.5, displayLabel: "0.5mg/5mL \u2014 common Indian pediatric strength; VERIFY on the dispensed pack" }, { tabletMg: 0.5, displayLabel: "0.5mg tablet" }] },
    ],
    adminNote: "Give WITH FOOD to reduce GI upset; may be mixed into a small amount of juice/food to mask bitterness. For croup, one-time dosing \u2014 do not continue daily. Dexamethasone's long half-life is why a single dose covers the croup illness course.",
    precaution: "Verify liquid concentrations carefully. If an ampoule (4mg/mL) is drawn up for oral procedural use, ensure dosing accounts for this much higher concentration.",
    notes: "For croup, dexamethasone is generally preferred over prednisolone (longer half-life, single dose). Nebulized budesonide (added separately) is the alternative if the child is vomiting or cannot take oral.",
  },
  {
    id: "methylprednisolone",
    name: "Methylprednisolone (oral)",
    category: "Analgesics / Antipyretics / Steroids",
    minAgeMonths: 0,
    sourceNote: "ADDED FROM THE HOSPITAL FORMULARY -- not in either uploaded dosing reference. 1-2mg/kg/day divided BID, max 60mg/day, is the NAEPP asthma-exacerbation convention (listed there for prednisone, prednisolone and methylprednisolone alike). Potency note: 4mg methylprednisolone is roughly equal to 5mg prednisolone, so this mg/kg range is slightly more generous than the prednisolone entry on a potency basis -- use the low end if in doubt. The only stocked strength is a 4mg tablet, so small children can only be dosed in half-tablet steps.",
    doseOptions: [
      { id: "standard", label: "Asthma exacerbation / inflammatory, short course (\u00f7BID)", low: 1, high: 2, freq: 2, maxDay: 60 },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Predmet (tablet)", manufacturer: "Sun Pharma", strengths: [{ tabletMg: 4, displayLabel: "4mg tablet" }] },
    ],
    adminNote: "Give WITH FOOD, in the MORNING, as a short course.",
    notes: "For a young child, prednisolone liquid (Omnacortil) is the more practical stocked option.",
  },
  // ================= RESPIRATORY =================
  {
    id: "levosalbutamol",
    name: "Levosalbutamol / Salbutamol (single agent, oral)",
    category: "Respiratory",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Bronchospasm, 0.05-0.1mg/kg/day \u00f73 doses", low: 0.05, high: 0.1, freq: 3, maxDay: 32 },
    ],
    sourceNote: "CORRECTION (second pass): per Dr. Gowdar's direct clinical convention, the correct figure is 0.05-0.1mg/kg/DAY divided into 3 doses -- not the 0.1-0.4mg/kg/dose this app briefly used in the previous correction pass, which was a mismatch between this app's own architecture (low/high always represents the daily total, divided by the freq shown) and a differently-framed per-dose figure from an earlier source. The original value before either correction (0.02-0.03) also wasn't simply 'wrong' on its own -- it was in roughly the right ballpark for a per-dose amount, but the slider itself was still broken regardless (step size larger than the whole range), which is the part that's now fixed architecturally for every drug, not just this one.",
    defaultDurationDays: 5,
    brands: [
      { name: "Levolin (single agent)", manufacturer: "Cipla", strengths: [{ mgPer5ml: 1 }] },
      { name: "Syrp Asthalin (single agent)", manufacturer: "Cipla", strengths: [{ mgPer5ml: 2, displayLabel: "Salbutamol (racemic) 2mg/5mL -- added per request; a different single-agent brand from Levolin, same manufacturer" }] },
    ],
    adminNote: "Oral beta-agonists are largely SUPERSEDED by inhaled therapy \u2014 prefer a spacer-delivered inhaler or nebulizer where available; use the oral syrup only when inhaled delivery isn't practical.",
    notes: "",
  },
  {
    id: "salbutamol-neb",
    name: "Salbutamol / Albuterol (inhaled \u2014 nebulized or MDI)",
    category: "Respiratory",
    topicalOnly: true,
    minAgeMonths: 0,
    sig: "NEBULIZED: 0.15mg/kg/dose (minimum 2.5mg, maximum 5mg) via jet nebulizer \u2014 for acute exacerbation give every 20 min up to 3 doses, then reassess; a fixed 2.5mg dose is standard for most children. MDI ALTERNATIVE (preferred if available): salbutamol 100mcg/puff via spacer, 4 or more puffs (one puff at a time), repeatable every 20 min up to 3 times in the first hour.",
    brands: [
      { name: "Asthalin Respules", manufacturer: "Cipla", strengths: [{ displayLabel: "2.5mg/2.5mL nebulizer respule" }, { displayLabel: "5mg/mL nebulizer solution (for weight-based dosing <2.5mg or titration)" }] },
      { name: "Asthalin HFA (MDI)", manufacturer: "Cipla", strengths: [{ displayLabel: "100mcg/actuation metered-dose inhaler \u2014 use WITH a spacer (\u00b1 face-mask for young children)" }] },
      { name: "Levolin Respules", manufacturer: "Cipla", strengths: [{ displayLabel: "Levosalbutamol 0.31mg / 0.63mg / 1.25mg respules \u2014 confirm which strength is stocked" }] },
    ],
    adminNote: "Deliver via JET nebulizer connected to an air compressor with a mouthpiece or well-fitting face mask; nebulize over 5-15 min. For MDI: shake before each puff, deliver ONE puff at a time with 5-6 breaths after each. pMDI-plus-spacer is at least as effective as a nebulizer for mild-moderate exacerbations and is preferred where available. Escalating need for salbutamol signals worsening asthma \u2014 reassess rather than simply repeating.",
    precaution: "Not established for acute bronchospasm below the labeled ages for some products \u2014 verify the dispensed product's minimum age. Watch for tachycardia, tremor, and hypokalemia with repeated dosing.",
    notes: "Largely replaces the oral salbutamol/levosalbutamol syrup for wheeze/asthma \u2014 inhaled delivery has a far better efficacy-to-side-effect profile.",
  },
  {
    id: "budesonide-neb",
    name: "Budesonide (nebulized inhalation suspension)",
    category: "Respiratory",
    topicalOnly: true,
    minAgeMonths: 12,
    sig: "ASTHMA maintenance (12 months-8 yr): 0.25-0.5mg once daily or divided BID; highest recommended 0.5mg/day if prior therapy was bronchodilators alone, up to 1mg/day if prior inhaled or oral corticosteroids. Start at the lowest effective dose and titrate down once stable. CROUP: 2mg nebulized as a single dose (reserve for the child who is vomiting or cannot take oral dexamethasone).",
    brands: [
      { name: "Budecort Respules", manufacturer: "Cipla", strengths: [{ displayLabel: "0.5mg/2mL respule" }, { displayLabel: "1mg/2mL respule" }, { displayLabel: "0.25mg/2mL respule" }] },
      { name: "Pulmicort Respules", manufacturer: "AstraZeneca", strengths: [{ displayLabel: "0.25mg/2mL, 0.5mg/2mL respule" }] },
    ],
    adminNote: "Administer via JET nebulizer connected to an air compressor \u2014 NOT an ultrasonic nebulizer (inadequate delivery). Use a mouthpiece or suitable face mask. RINSE the mouth (and wash the face if a mask is used) after each dose to prevent oral candidiasis. Do NOT mix with other nebulizer solutions unless compatibility is established.",
    precaution: "NOT a reliever \u2014 does not relieve acute symptoms; acute bronchospasm needs inhaled salbutamol. Labeled for children 12 months to 8 years. Monitor growth velocity with prolonged use; titrate to the lowest effective dose. Rare paradoxical bronchospasm \u2014 stop and treat with a fast-acting bronchodilator if it occurs.",
    notes: "The only inhaled corticosteroid labeled below 4 years, making it the practical nebulized ICS for young children. For croup, oral dexamethasone remains first-line; nebulized budesonide 2mg is the alternative route.",
  },
  {
    id: "ipratropium-neb",
    name: "Ipratropium Bromide (nebulized \u2014 adjunct to salbutamol)",
    category: "Respiratory",
    topicalOnly: true,
    minAgeMonths: 0,
    sig: "ADJUNCT TO SALBUTAMOL for MODERATE-SEVERE acute asthma exacerbation (add-on, NOT monotherapy). MULTIPLE-DOSE protocol (preferred): 0.25-0.5mg (250-500mcg) nebulized WITH each of the first 3 salbutamol doses, every 20 min over the first hour, then STOP once improving. Weight-based single dose alternative: <30kg = 0.5mg nebulized once; \u226530kg = 1mg nebulized once. pMDI ALTERNATIVE: 4 puffs of 20mcg by spacer with SABA, up to 3 times. Use only in the first 1-2 hours of a moderate/severe exacerbation \u2014 no proven benefit in mild exacerbations or as ongoing therapy.",
    brands: [
      { name: "Ipravent Respules", manufacturer: "Cipla", strengths: [{ displayLabel: "250mcg/mL nebulizer respule (0.25mg/mL)" }, { displayLabel: "500mcg/2mL nebulizer respule \u2014 confirm which strength is stocked" }] },
      { name: "Ipravent (MDI)", manufacturer: "Cipla", strengths: [{ displayLabel: "20mcg/actuation metered-dose inhaler \u2014 use WITH a spacer (\u00b1 face-mask for young children)" }] },
      { name: "Duolin Respules (+Levosalbutamol)", manufacturer: "Cipla", strengths: [{ displayLabel: "Ipratropium 500mcg + Levosalbutamol 1.25mg per 2.5mL respule \u2014 FIXED COMBINATION; if used, do NOT also give a separate salbutamol/levosalbutamol nebulization (double-dosing the beta-agonist). Confirm the exact stocked strength." }] },
    ],
    adminNote: "Deliver via a JET nebulizer connected to an air compressor, over 5-15 min; may be mixed in the same nebulizer cup with salbutamol if given within 1 hour. Use a MOUTHPIECE where possible, or a WELL-FITTING mask \u2014 keep the nebulized mist OUT of the eyes (aerosol contact can cause transient pupil dilation, blurred vision, and precipitate/worsen acute angle-closure glaucoma). This is an ADD-ON to salbutamol and systemic corticosteroid, given in the acute setting only; discontinue once the child improves \u2014 it has no role in maintenance or home asthma control. Reassess after each set of doses.",
    precaution: "Adjunct ONLY \u2014 not a substitute for salbutamol or systemic steroid, and not a reliever the family should continue at home. Evidence of benefit (reduced hospitalization) is concentrated in MODERATE-SEVERE exacerbations; mild exacerbations do not benefit. FDA safety/effectiveness for nebulized ipratropium is formally established only for maintenance COPD bronchodilation in patients \u226512 years \u2014 pediatric acute-asthma use is guideline-supported but off-label. Common effects: dry mouth, throat irritation; keep out of eyes as above. Caution (relative) with bladder-neck obstruction and, historically, soy/peanut allergy for older MDI formulations \u2014 verify the specific product.",
    notes: "Typical total exposure across an ED visit is 3 doses of 250-500mcg over the first hour added to salbutamol; benefit is greatest when started within the first 2 hours. GINA 2026 gives 0.25mg nebulized (or 4 puffs of 20mcg by spacer) with SABA up to 3 times for moderately-severe/severe exacerbations in children \u22645 years. Pediatrics in Review gives 0.25-0.5mg every 20 min for 3 doses, or a single weight-based dose (<30kg 0.5mg; \u226530kg 1mg).",
  },
  {
    id: "ambroxol",
    name: "Ambroxol (single agent)",
    category: "Respiratory",
    minAgeMonths: 24,
    ageBased: true,
    sourceNote: "UPDATED per Dr. Gowdar's direct correction to a more precise, age-banded regimen (roughly 1.2-1.6mg/kg/day overall, 2-3 divided doses) -- replacing this app's earlier, coarser 2-band Indian-convention estimate. Total daily ranges: 2-5yr 15-30mg/day, 6-11yr 30-45mg/day, 12-17yr 60-90mg/day, all \u00f73 doses; the per-dose figures below are the commonly-cited typical dose within each range, not the only acceptable point in it.",
    ageBands: [
      { minMonths: 24, maxMonths: 71, label: "2-5 yr: 7.5mg TID (15-30mg/day total)", freqText: "TID (three times daily)" },
      { minMonths: 72, maxMonths: 143, label: "6-11 yr: 15mg BID-TID (30-45mg/day total)", freqText: "BID-TID" },
      { minMonths: 144, maxMonths: 999, label: "\u226512 yr: 25mg TID (60-90mg/day total)", freqText: "TID (three times daily)" },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Mucolite syrup", manufacturer: "Dr Reddy's", strengths: [{ mgPer5ml: 30 }] },
      { name: "Mucolite-SR", manufacturer: "Dr Reddy's", strengths: [{ tabletMg: 75, displayLabel: "75mg sustained-release capsule -- adolescent/older-child use, not for crushing/opening" }] },
      { name: "Mucolite drops", manufacturer: "Dr Reddy's", strengths: [{ mgPerMl: 7.5 }] },
    ],
    precaution: "Modest evidence for mucolytics generally in children \u2014 consider whether one is indicated at all before prescribing. Generally avoid under 2 years.",
    adminNote: "With or without food.",
    notes: "",
  },
  {
    id: "montelukast",
    name: "Montelukast (single agent)",
    category: "Respiratory",
    minAgeMonths: 24,
    ageBased: true,
    sourceNote: "ADDED FROM THE HOSPITAL FORMULARY -- not in either uploaded dosing reference; bands (2-5yr 4mg, 6-14yr 5mg, \u226515yr 10mg, once daily) are the standard labeled convention and match the montelukast component used in the combination entry. The 6-23 month granule strength is not stocked, so the floor here is 2 years. Choose the brand row that matches the dose shown (4mg / 5mg chewable, 10mg tablet).",
    ageBands: [
      { minMonths: 24, maxMonths: 71, label: "2-5 yr: 4mg once daily", freqText: "once daily in the EVENING" },
      { minMonths: 72, maxMonths: 179, label: "6-14 yr: 5mg once daily", freqText: "once daily in the EVENING" },
      { minMonths: 180, maxMonths: 999, label: "\u226515 yr: 10mg once daily", freqText: "once daily in the EVENING" },
    ],
    defaultDurationDays: 30,
    brands: [
      { name: "Montair 4 mg (chewable)", manufacturer: "Cipla", strengths: [{ tabletMg: 4, displayLabel: "4mg chewable tablet (2-5 yr)" }] },
      { name: "Montair 5 mg (chewable)", manufacturer: "Cipla", strengths: [{ tabletMg: 5, displayLabel: "5mg chewable tablet (6-14 yr)" }] },
      { name: "Montair 10 mg", manufacturer: "Cipla", strengths: [{ tabletMg: 10, displayLabel: "10mg tablet (\u226515 yr)" }] },
    ],
    adminNote: "Once daily in the EVENING. Chewable tablets should be chewed; with or without food. Chewables may contain phenylalanine (aspartame) \u2014 relevant in phenylketonuria.",
    precaution: "Labeled neuropsychiatric warning (mood, behavior, sleep changes, suicidal thoughts) \u2014 counsel the caregiver; this is a boxed-style warning, not a rare theoretical risk.",
    notes: "",
  },
  {
    id: "cough-cold-fdc",
    name: "Cough-Cold Fixed-Dose Combinations (multiple brands)",
    category: "Respiratory",
    topicalOnly: true,
    discouraged: true,
    sig: "NOT RECOMMENDED as a class in this age group \u2014 no dose given",
    brands: [
      { name: "Ascoril LS-Junior / Ascoril+ / Exp Ascoril LS", manufacturer: "Glenmark", strengths: [{ displayLabel: "Levosalbutamol/Terbutaline + Ambroxol/Bromhexine + Guaiphenesin" }] },
      { name: "Chericof / Chericof-LS Junior", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "Various bronchodilator/mucolytic/antitussive combinations" }] },
      { name: "Levolin Plus / Levolin Plus-Junior", manufacturer: "Cipla", strengths: [{ displayLabel: "Levosalbutamol 1mg + Ambroxol 30mg + Guaiphenesin 50mg per 5mL (Junior: Levosalbutamol 0.5mg + Ambroxol 15mg + Guaiphenesin 50mg per 5mL) -- CORRECTED, previously listed without the ambroxol component" }] },
      { name: "Macbery-Junior", manufacturer: "Macleods", strengths: [{ displayLabel: "Levosalbutamol + Ambroxol + Guaiphenesin" }] },
      { name: "Turby-CZ", manufacturer: "Right", strengths: [{ displayLabel: "Terbutaline + Bromhexine + Guaiphenesin + Menthol" }] },
      { name: "Syrp Alex range / Ascoril D Junior / Grilinctus / Piriton-CS", manufacturer: "Various", strengths: [{ displayLabel: "Dextromethorphan \u00b1 Chlorpheniramine/Phenylephrine/Guaiphenesin" }] },
      { name: "Reswas JR", manufacturer: "Dr Reddy's", strengths: [{ displayLabel: "Levodropropizine 30mg + Chlorpheniramine 2mg per 5mL -- CORRECTED, this app previously grouped it with the dextromethorphan-based products above, which was wrong; it's a different antitussive class entirely, but still a multi-ingredient cough combination the same caution applies to" }] },
      { name: "Piriton Expectorant / Maxtra / T-Minic / Sinarest-AF", manufacturer: "Various", strengths: [{ displayLabel: "Chlorpheniramine \u00b1 Phenylephrine/Ammonium chloride" }] },
    ],
    precaution: "IMPORTANT \u2014 per the uploaded reference: 'Over-the-counter cough/cold and multi-ingredient combination syrups (dextromethorphan, chlorpheniramine, phenylephrine, ambroxol/guaifenesin/bronchodilator mixes) are NOT RECOMMENDED and should not be used under 4 years \u2014 no proven efficacy and documented serious/fatal toxicity (FDA, AAP, ACEP, CHEST).' Oral phenylephrine specifically is an ineffective decongestant at labeled doses. Dextromethorphan-containing products are contraindicated under 2 years and not recommended under 4 regardless. Levodropropizine (Reswas JR) is a different antitussive class with less pediatric safety data, not simply a dextromethorphan equivalent -- grouped here for the same general discouragement, not because the pharmacology is identical. These products remain in OPD stock but this app deliberately does not provide a dose for them.",
    notes: "Evidence-based alternatives per the same reference: honey (\u22651yr) for cough, saline nasal drops/irrigation for congestion, fluids, and paracetamol/ibuprofen for fever distress if the child is uncomfortable.",
  },
  // ================= GASTROINTESTINAL =================
  {
    id: "esomeprazole",
    name: "Esomeprazole",
    category: "Gastrointestinal",
    minAgeMonths: 1,
    sourceNote: "The age/weight cutoffs document lists esomeprazole (grouped with H2 blockers/PPIs generally) among agents where age cutoffs were not found in its retrieved sources -- this app's 1-month floor reflects the granule formulation's pediatric-specific design (see Notes) rather than a confirmed label figure. Verify against Torrent's package insert. Both dosing methods below are from the same Harriet Lane source: the weight-band table is the more standard/citable GERD convention and is this app's default; the 0.7-4mg/kg/day continuous range is that same reference's broader reported effective range, noting children 1-6yr may need the higher end due to faster clearance.",
    weightBandTable: true,
    weightBandFreqPerDay: 1,
    weightBandShowDuration: true,
    weightBands: [
      { maxKg: 20, mg: 10, label: "10-<20kg: ~10mg once daily" },
      { maxKg: 999, mg: 20, label: "\u226520kg: 10-20mg once daily" },
    ],
    doseOptions: [
      { id: "mgkg-alt", label: "mg/kg alternative: 0.7-4mg/kg/day once daily (higher end for 1-6yr)", low: 0.7, high: 4, freq: 1, maxDay: 40 },
    ],
    defaultDurationDays: 14,
    brands: [
      { name: "Nexpro Junior", manufacturer: "Torrent", strengths: [{ tabletMg: 10, displayLabel: "10mg granule sachet" }] },
    ],
    adminNote: "Give 30-60 MIN BEFORE the first meal of the day. Granules may be mixed with soft acidic food (applesauce) and swallowed without chewing \u2014 do not chew or crush.",
    notes: "Genuinely pediatric-specific granule formulation, purpose-dosed for children rather than an adult capsule used off-label.",
  },
  {
    id: "domperidone",
    name: "Domperidone",
    category: "Gastrointestinal",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists domperidone among agents where a specific age cutoff was not established in its retrieved sources -- confirm against the dispensed product label. The QT-prolongation precaution below is independent of and does not depend on resolving this age-cutoff gap.",
    doseOptions: [
      { id: "standard", label: "Nausea/vomiting, dysmotility, 3x/day", low: 0.25, high: 0.25, freq: 3, maxDay: 30 },
    ],
    defaultDurationDays: 3,
    brands: [
      { name: "Domstal syrup", manufacturer: "Torrent", strengths: [{ mgPerMl: 1 }] },
      { name: "Domstal drops", manufacturer: "Torrent", strengths: [{ mgPerMl: 10 }] },
      { name: "Domstal tablet", manufacturer: "Torrent", strengths: [{ tabletMg: 10, displayLabel: "10mg tablet" }] },
    ],
    precaution: "QT-PROLONGATION RISK \u2014 use the lowest effective dose for the shortest duration; avoid in children with known cardiac or electrolyte disorders. Not FDA-approved for general pediatric use in the US for this reason; CDSCO carries the same cardiac caution.",
    adminNote: "Give 15-30 MIN BEFORE meals.",
    notes: "",
  },
  {
    id: "ondansetron",
    name: "Ondansetron",
    category: "Gastrointestinal",
    minAgeMonths: 6,
    weightBandTable: true,
    weightBands: [
      { maxKg: 15, mg: 2, label: "8-15kg: 2mg single dose" },
      { maxKg: 30, mg: 4, label: ">15-30kg: 4mg single dose" },
      { maxKg: 999, mg: 8, label: ">30kg: 8mg single dose" },
    ],
    minWeightKg: 8,
    doseOptions: [
      { id: "mgkg-alt", label: "mg/kg alternative: 0.1-0.15mg/kg single dose", lowDose: 0.1, highDose: 0.15, freqLabel: "single dose", maxDayPerKg: 0.15, maxDayAbsolute: 8 },
    ],
    isPRN: true,
    sourceNote: "Both dosing methods come from the same Harriet Lane source -- the weight-band table is the more standard/citable convention and is this app's default, but the 0.1-0.15mg/kg continuous formula is the same reference's stated alternative. They give very similar results at most weights; pick whichever you prefer to write on the script. FDA has only formally established a minimum age (\u22654 years) for the chemotherapy/radiotherapy-induced nausea indication -- oral use for acute gastroenteritis vomiting is guideline-supported but off-label, with no separate FDA-established minimum age for that use. In severe hepatic impairment, cap at 8mg/day total regardless of which method is used.",
    defaultDurationDays: 1,
    brands: [
      { name: "Syrp Emeset", manufacturer: "Cipla", strengths: [{ mgPer5ml: 2 }, { tabletMg: 4, displayLabel: "4mg tablet" }, { tabletMg: 8, displayLabel: "8mg tablet" }] },
      { name: "Vomikind-MD", manufacturer: "Mankind", strengths: [{ tabletMg: 4, displayLabel: "4mg orally-disintegrating tablet -- from general market knowledge, NOT independently verified against this pharmacy's stock or a label photo; add only if actually confirmed on the shelf" }, { tabletMg: 8, displayLabel: "8mg orally-disintegrating tablet -- same caveat" }] },
    ],
    adminNote: "Single dose for vomiting limiting oral rehydration in acute gastroenteritis \u2014 not routine repeated dosing. Ready-made solution, room temperature, protect from light, store upright.",
    notes: "Best evidence base for the AGE indication is \u22654 years.",
  },
  {
    id: "racecadotril",
    name: "Racecadotril",
    category: "Gastrointestinal",
    minAgeMonths: 3,
    weightBandTable: true,
    weightBandFreqPerDay: 3,
    weightBandShowDuration: true,
    weightBands: [
      { maxKg: 9, mg: 10, label: "<9kg: 10mg Q8h" },
      { maxKg: 13, mg: 20, label: "9-13kg: 20mg Q8h" },
      { maxKg: 999, mg: 30, label: ">13kg: 30mg Q8h" },
    ],
    sourceNote: "Restructured from a flat 1.5mg/kg slider to the precise weight bands given in the age/weight cutoffs document (Liang et al., Cochrane, 2019) -- these convert directly to whole sachet counts (1, 2, or 3 x 10mg sachets), which is more practical than a slider requiring mg-to-sachet conversion. Trials covered ages ~1-36 months; this app's 3-month floor is a reasonable practical start point within that range.",
    defaultDurationDays: 5,
    brands: [
      { name: "Redotil", manufacturer: "Dr Reddy's", strengths: [{ tabletMg: 10, displayLabel: "10mg sachet" }] },
      { name: "Zedott", manufacturer: "Torrent", strengths: [{ tabletMg: 10, displayLabel: "10mg sachet" }] },
      { name: "Racigyl-SB (+ S. boulardii)", manufacturer: "Mankind", strengths: [{ tabletMg: 15, displayLabel: "15mg racecadotril + 2.5 billion CFU S. boulardii per sachet" }] },
    ],
    adminNote: "Give WITH MEALS, alongside ORS \u2014 this is an antisecretory adjunct, NOT a substitute for rehydration. Max ~7 days.",
    notes: "CORRECTION: Zedott is racecadotril, not ondansetron as an earlier pass of this project had mis-assumed \u2014 corrected here against the confirmed pharmacy formulary composition. CORRECTION: Racigyl-SB is 15mg racecadotril per sachet, not 10mg as this app previously stated -- verify which sachet size the weight-band dose actually calls for when substituting this brand for Redotil/Zedott, since it isn't a direct 1:1 swap.",
  },
  {
    id: "simethicone",
    name: "Simethicone (\u00b1 carminative combination)",
    category: "Gastrointestinal",
    minAgeMonths: 0,
    sourceNote: "The age/weight cutoffs document lists simethicone among agents where a specific age cutoff was not established in its retrieved sources -- generally regarded as safe from birth given minimal systemic absorption, but this app has no independently confirmed floor beyond that general understanding.",
    doseOptions: [
      { id: "standard", label: "Colic/gas, up to 4x/day", low: 20, high: 40, freq: 4, maxDay: 160, isDirectMgOption: true },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Syrp Colicaid", manufacturer: "Meyer", strengths: [{ mgPer5ml: 40 }] },
      { name: "Colicaid drops", manufacturer: "Meyer", strengths: [{ mgPerMl: 40 }] },
    ],
    precaution: "Benefit for infant colic is largely symptomatic/placebo-level per the evidence \u2014 reasonable to try given its favorable safety profile, but set expectations accordingly with the family.",
    adminNote: "Give with or just before feeds.",
    notes: "",
  },
  {
    id: "dicyclomine-simethicone",
    name: "Dicyclomine + Simethicone",
    category: "Gastrointestinal",
    minAgeMonths: 6,
    doseOptions: [
      { id: "standard", label: "Colic/spasm, TDS (\u22656 months only)", low: 10, high: 20, freq: 3, maxDay: 60, isDirectMgOption: true },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Cyclopam", manufacturer: "Indoco", strengths: [{ mgPer5ml: 10, displayLabel: "Dicyclomine 10mg + Simethicone 40mg /5mL" }] },
    ],
    precaution: "DICYCLOMINE IS CONTRAINDICATED UNDER 6 MONTHS \u2014 documented risk of apnea and seizures in infants. This is a hard age floor, not a relative caution.",
    adminNote: "With or without food.",
    notes: "Corrects an earlier mis-assumption in this project that this product contained paracetamol rather than simethicone.",
  },
  {
    id: "drotaverine",
    name: "Drotaverine",
    category: "Gastrointestinal",
    minAgeMonths: 12,
    ageBased: true,
    sourceNote: "Limited pediatric data per the uploaded reference \u2014 weight/age-based dosing described only loosely; the age-tiered figures below are the closest usable breakdown given.",
    ageBands: [
      { minMonths: 12, maxMonths: 71, label: "1-6 yr: 20mg, 3x/day", freqText: "3x/day" },
      { minMonths: 72, maxMonths: 999, label: "\u22656 yr: 40-80mg, 3x/day", freqText: "3x/day" },
    ],
    defaultDurationDays: 3,
    brands: [
      { name: "Drotin DS", manufacturer: "Walter Bushnell", strengths: [{ mgPer5ml: 20 }] },
    ],
    precaution: "Limited pediatric data \u2014 use judiciously.",
    notes: "",
  },
  {
    id: "lactulose",
    name: "Lactulose",
    category: "Gastrointestinal",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Constipation (\u00f7 divided doses)", low: 0.7, high: 2, freq: 2, maxDay: 60 },
    ],
    defaultDurationDays: 14,
    brands: [
      { name: "Syrp Duphalac", manufacturer: "Abbott", strengths: [{ mgPer5ml: 3335, displayLabel: "3.335g/5mL" }] },
      { name: "Laxolite", manufacturer: "J", strengths: [{ mgPer5ml: 3333, displayLabel: "10g/15mL \u2248 3.33g/5mL -- this concentration was not independently verified in the most recent market-listing review; check the pack" }] },
    ],
    adminNote: "With or without food; may mix with water/juice/milk.",
    notes: "Well tolerated in infants <1yr -- preferred over PEG where PEG isn't available or tolerated. A brand called 'Livoluk Kid' also came up as needing verification during the same review but isn't in this app's brand list at all -- if that's actually what's on your shelf rather than Laxolite, its concentration would need to be added fresh, not assumed to match Laxolite's.",
  },
  {
    id: "peg3350",
    name: "Polyethylene Glycol 3350 (Macrogol)",
    category: "Gastrointestinal",
    minAgeMonths: 6,
    isGramDose: true,
    doseOptions: [
      { id: "disimpaction", label: "Disimpaction (x3-6 days)", low: 1, high: 1.5, freq: 1, maxDay: 100 },
      { id: "maintenance", label: "Maintenance (start low, titrate)", low: 0.2, high: 0.8, freq: 1, maxDay: 17 },
    ],
    sourceNote: "Age floor added (6 months) per the age/weight cutoffs document -- this app previously had none. That source's figure is specifically for PEG-3350+electrolytes bowel-prep formulations; plain PEG-3350 (no electrolytes, the more common maintenance-laxative use here) had no separate age cutoff in its retrieved sources. Under 2 years: monitor for hypoglycemia (PEG-electrolyte prep provides no caloric substrate) and watch for dehydration/hypokalemia.",
    precaution: "Under 2 years: monitor for hypoglycemia, dehydration, and hypokalemia -- this age group has been specifically flagged for these effects with PEG-electrolyte formulations.",
    defaultDurationDays: 14,
    brands: [
      { name: "Powd Peglec", manufacturer: "Tablets India", strengths: [{ gramsPerSachet: 137.5, displayLabel: "137.5g bowel-evacuant sachet" }] },
      { name: "Ezlax", manufacturer: "Nouveau", strengths: [{ gramsPerSachet: 10.4, displayLabel: "10.4g sachet" }] },
    ],
    adminNote: "Dissolve each dose in water/juice per label; ensure adequate fluid intake; titrate maintenance dose to 1-2 soft stools/day.",
    notes: "Maintenance starting dose 0.4g/kg/day is the reference's suggested starting point within the 0.2-0.8g/kg/day titration range used here.",
  },
  {
    id: "gaviscon",
    name: "Sodium Alginate (\u00b1 bicarbonate/calcium carbonate)",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "Infant sachets given AFTER FEEDS, per label weight bands (verify the exact stocked formulation \u2014 sachet vs 150mL liquid may follow different weight cutoffs)",
    brands: [{ name: "Gaviscon", manufacturer: "Reckitt", strengths: [{ displayLabel: "Sodium alginate + Sodium bicarbonate + Calcium carbonate, 150mL liquid" }] }],
    adminNote: "Give after feeds.",
    notes: "The OPD stock item is the 150mL LIQUID, which may be formulated for older children/adults rather than the infant sachet powder -- confirm which exact product is on the shelf before dosing.",
  },
  {
    id: "ranitidine",
    name: "Ranitidine",
    category: "Gastrointestinal",
    topicalOnly: true,
    discouraged: true,
    sig: "NOT RECOMMENDED \u2014 withdrawn from most markets; use an alternative acid suppressant (esomeprazole/PPI or famotidine)",
    brands: [{ name: "Rantac", manufacturer: "JB Pharma", strengths: [{ displayLabel: "75mg/5mL syrup" }] }],
    precaution: "WITHDRAWN in most markets due to NDMA contamination that worsens with storage time/temperature. Genuine safety flag, not just a sourcing gap \u2014 worth checking batch/expiry and current CDSCO status if physically in stock. Esomeprazole (Nexpro Junior, already in this app) is the direct alternative already stocked.",
    notes: "",
  },
  {
    id: "citrate-alkalinizer",
    name: "Potassium Citrate / Disodium Hydrogen Citrate",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "Dose per indication and weight, adjusted to urine pH \u2014 not a fixed formula",
    brands: [
      { name: "Citralka", manufacturer: "Pfizer", strengths: [{ displayLabel: "Disodium hydrogen citrate 1.53g/5mL" }] },
      { name: "Urikind-K", manufacturer: "Mankind", strengths: [{ displayLabel: "Potassium citrate 1100mg + Citric acid 334mg /5mL" }] },
    ],
    notes: "Used for dysuria, urinary stone prophylaxis, RTA \u2014 titrate to urine pH response rather than a weight-based formula.",
  },
  {
    id: "zinc",
    name: "Zinc (elemental)",
    category: "Gastrointestinal",
    minAgeMonths: 0,
    ageBased: true,
    ageBands: [
      { minMonths: 0, maxMonths: 5, label: "<6 mo: 10mg once daily x10-14 days", freqText: "once daily x10-14 days" },
      { minMonths: 6, maxMonths: 999, label: "\u22656 mo: 20mg once daily x10-14 days", freqText: "once daily x10-14 days" },
    ],
    defaultDurationDays: 14,
    brands: [
      { name: "Nuzinco", manufacturer: "Azveston", strengths: [{ mgPer5ml: 20 }] },
      { name: "Zinconia", manufacturer: "Zuventus", strengths: [{ mgPer5ml: 20 }, { tabletMg: 50, displayLabel: "50mg tablet (zinc acetate -- confirm elemental zinc equivalence with the pharmacy before substituting for the sulfate-based liquid dose)" }] },
      { name: "Z&D (drops)", manufacturer: "Dr Reddy's", strengths: [{ mgPerMl: 20 }] },
      { name: "Zincogut (drops)", manufacturer: "Centaur", strengths: [{ mgPerMl: 20 }] },
    ],
    adminNote: "With or without food; if given alongside iron, separate the doses. Continue the FULL 10-14 days even after diarrhea stops -- this is the single most common real-world dosing error with zinc.",
    notes: "Reduces duration/severity/recurrence of acute diarrhea as an adjunct -- give alongside ORS, not instead of it.",
  },
  {
    id: "ors",
    name: "Oral Rehydration Salts (WHO low-osmolarity)",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "~50-100 mL/kg over 3-4h for mild-moderate dehydration, plus ongoing losses replaced as they occur",
    brands: [{ name: "Gran Electral", manufacturer: "FDC", strengths: [{ displayLabel: "WHO formula sachet, 4.4g" }] }],
    adminNote: "Offer small, frequent sips/spoonfuls (5mL every 1-2 min); continue breastfeeding/feeding throughout. Reconstitute one sachet in the stated volume of clean water; DISCARD AFTER 24H. Do not add sugar or boil the solution after mixing.",
  },
  {
    id: "probiotic-sboulardii",
    name: "Probiotic \u2014 Saccharomyces boulardii",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "250-500 mg once daily x5-7 days",
    brands: [
      { name: "Econorm", manufacturer: "Dr Reddy's", strengths: [{ displayLabel: "250mg / 5 billion CFU sachet" }] },
    ],
    adminNote: "With or without food; do NOT mix into hot liquids (kills the organisms). Separate dosing from systemic antifungals if both are prescribed.",
    notes: "Shortens diarrhea by ~1 day per the evidence \u2014 one of the two strains with the strongest evidence base for acute gastroenteritis.",
  },
  {
    id: "probiotic-lgg",
    name: "Probiotic \u2014 Lactobacillus rhamnosus GG",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "\u226510\u00b9\u2070 CFU once daily x5-7 days",
    brands: [
      { name: "Unicflora-GG", manufacturer: "Nest", strengths: [{ displayLabel: "1 billion CFU/4mL \u2014 confirm this meets the \u226510^10 CFU target dose per label" }] },
      { name: "Sporlac-G", manufacturer: "JB Pharma", strengths: [{ displayLabel: "6 billion CFU/0.75g \u2014 confirm this meets the \u226510^10 CFU target dose per label" }] },
    ],
    adminNote: "With or without food; do NOT mix into hot liquids (kills the organisms).",
    notes: "One of the two strains with the strongest evidence base for acute gastroenteritis, alongside S. boulardii. Both stocked brands are below the \u226510^10 CFU/day target as single doses -- check whether the label recommends multiple doses/day to reach it.",
  },
  {
    id: "probiotic-lreuteri",
    name: "Probiotic \u2014 Lactobacillus reuteri DSM 17938",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "Diarrhea: 10\u2078 CFU once daily x5 days. Infantile colic: ~10\u2078 CFU once daily",
    brands: [
      { name: "Liqd Protectis", manufacturer: "Dr Reddy's", strengths: [{ displayLabel: "5mL unit, DSM 17938 strain specifically named" }] },
      { name: "Unicflora-R T", manufacturer: "Nest", strengths: [{ displayLabel: "100 million CFU/5mL = 10^8 CFU \u2014 matches the target dose" }] },
    ],
    adminNote: "With or without food; do NOT mix into hot liquids (kills the organisms).",
    notes: "The only strain here with evidence for both acute diarrhea and infantile colic.",
  },
  {
    id: "probiotic-bclausii",
    name: "Probiotic \u2014 Bacillus clausii / B. coagulans / Lactic acid Bacillus",
    category: "Gastrointestinal",
    topicalOnly: true,
    sig: "Per product label \u2014 no specific evidence-based target dose given in the reference",
    brands: [
      { name: "Tufpro", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "2 billion spores/5mL" }] },
      { name: "Puregut-BC", manufacturer: "Nest", strengths: [{ displayLabel: "2 billion spores/5mL" }] },
      { name: "Sporlac (Lactic acid Bacillus)", manufacturer: "Uni-Sankyo", strengths: [{ displayLabel: "150 million units/1.8g sachet" }] },
      { name: "Gut OK (B. coagulans + Lactobacillus)", manufacturer: "Mankind", strengths: [{ displayLabel: "Dry syrup" }] },
    ],
    adminNote: "With or without food; do NOT mix into hot liquids (kills the organisms).",
    precaution: "Weaker/more variable evidence than S. boulardii or L. rhamnosus GG per the uploaded reference, despite being the most commonly stocked and prescribed probiotic class in India. Reasonable to use, but don't present it to a family as equivalent-strength evidence to the two strains above.",
    notes: "",
  },
  // ================= IRON =================
  {
    id: "iron",
    name: "Iron (elemental)",
    category: "Iron",
    minAgeMonths: 0,
    doseOptions: [
      { id: "conventional", label: "IDA treatment \u2014 conventional iron salts (all brands EXCEPT Tasiron), \u00f7 once daily-BID", low: 3, high: 6, freq: 2, maxDay: 200 },
      { id: "liposomal", label: "IDA treatment \u2014 liposomal/micro-encapsulated iron (Tasiron ONLY), once daily", low: 1.5, high: 1.5, freq: 1, maxDay: 100 },
      { id: "prophylaxis", label: "Prophylaxis (conventional iron salts), exclusively breastfed term infant from 4 months", low: 1, high: 2, freq: 1, maxDay: 30 },
    ],
    sourceNote: "SIMPLIFIED per Dr. Gowdar's direct correction: exactly two treatment regimens now -- 3-6mg/kg/day for every conventional-salt brand here (Feronia-XT, Orofer-XT, Nuhemo, Trifer, Raricap), and a SEPARATE 1.5mg/kg/day once-daily regimen that applies ONLY to Tasiron's liposomal/micro-encapsulated products. Picking 'conventional' with a Tasiron brand, or 'liposomal' with a conventional-salt brand, is a mismatch -- match the regimen to the brand actually selected below. Prophylaxis (1-2mg/kg/day, breastfed term infants from 4 months) remains a separate indication, not a third treatment-dose variant.",
    defaultDurationDays: 90,
    brands: [
      { name: "Syrp Feronia-XT", manufacturer: "Zuventus", strengths: [{ mgPer5ml: 30, displayLabel: "Ferrous ascorbate, 30mg elemental Fe/5mL" }] },
      { name: "Orofer-XT (drops)", manufacturer: "Emcure", strengths: [{ mgPerMl: 10, displayLabel: "Ferrous ascorbate, 10mg elemental Fe/mL" }] },
      { name: "Nuhemo (drops)", manufacturer: "Azveston", strengths: [{ mgPerMl: 10, displayLabel: "Ferrous ascorbate, approx. 10mg elemental Fe/mL \u2014 verify exact label" }] },
      { name: "Drop Trifer", manufacturer: "Apex", strengths: [{ mgPerMl: 50, displayLabel: "Iron (III) hydroxide polymaltose, 50mg elemental Fe/mL" }] },
      { name: "Drop Raricap", manufacturer: "Strides", strengths: [{ mgPerMl: 10, displayLabel: "Ferrous calcium citrate, 10mg elemental Fe/mL" }] },
      { name: "Tasiron (syrup)", manufacturer: "Inzpera", strengths: [{ mgPer5ml: 10, displayLabel: "Ferric di-phosphate (micronized micro-encapsulated), 10mg elemental Fe + 15mcg folic acid /5mL -- CONFIRMED FROM THE ACTUAL PRODUCT LABEL PHOTO" }] },
      { name: "Tasiron Baby Drops", manufacturer: "Inzpera", strengths: [{ mgPerMl: 10, displayLabel: "10mg elemental Fe/mL -- CORRECTED per Dr. Gowdar's direct confirmation (previously listed as 5mg/mL)" }] },
      { name: "Tasiron sachet (0.75g)", manufacturer: "Inzpera", strengths: [{ tabletMg: 8, displayLabel: "0.75g sachet: ferric di-phosphate, 8mg elemental Fe + 30mcg folic acid + 0.9mcg B12 -- CONFIRMED FROM THE ACTUAL PRODUCT LABEL PHOTO" }] },
    ],
    adminNote: "IDEALLY ON AN EMPTY STOMACH, 1h before food, with vitamin C/citrus to enhance absorption. SEPARATE from milk, dairy, calcium, and antacids by \u22652h. If GI upset occurs, give with a small non-dairy snack instead. Use a syringe, place toward the back/side of the mouth; RINSE MOUTH/BRUSH TEETH after drops to limit staining. Alternate-day dosing may improve absorption/tolerance if daily dosing isn't tolerated. Tasiron syrup reconstitution specifically (from the pack): fill to the 150mL mark with boiled-and-cooled water, shake vigorously, REFRIGERATE after reconstitution, use within 30 days, shake before each dose, and use only the TruServ spoon provided. FOR TASIRON PRODUCTS SPECIFICALLY: select the 'Liposomal/micro-encapsulated iron' regimen above (1.5mg/kg/day), not the conventional-salt regimens, which are dosed differently and are for the other iron brands in this list.",
    notes: "MAJOR CORRECTION, confirmed directly from photographed product labels (not just formulary text): Tasiron syrup is 10mg elemental Fe/5mL, NOT 30mg/5mL as this app previously stated -- the old figure would have calculated a volume delivering roughly 3x less iron than intended, since the dose math divides the target mg by a concentration that was itself 3x too high. The syrup's iron salt is ferric di-phosphate, not ferrous ascorbate. The 0.75g sachet is confirmed at 8mg elemental Fe with 30mcg folic acid. Dr. Gowdar separately confirmed the drops at 10mg/mL (now reflected above). Two previously-listed sachet entries have since been REMOVED per Dr. Gowdar's direct correction -- a '1g sachet, 15mg' and a '3g sachet, 30mg' -- neither exists in the market; the 0.75g/8mg sachet (photo-confirmed) is now the only sachet size in this app. 'Liposomal' is pharmacy-marketing language; the actual pack says 'micronized micro-encapsulated iron technology.'",
  },
  // ================= VITAMIN D & CALCIUM =================
  {
    id: "vitamind3",
    name: "Vitamin D3 (Cholecalciferol)",
    category: "Vitamin D & Calcium",
    minAgeMonths: 0,
    sourceNote: "Ultra-D3 syrup's concentration is UNVERIFIED and worth flagging prominently -- see that brand's own note below. A 20-fold concentration ambiguity on a vitamin D product is exactly the kind of thing that produces either a dangerously large or a clinically useless dose if guessed wrong; check the physical pack before relying on this row for that specific brand. All other brands here (Nutri-D, Kidrich-D3, Depura, Arachitol Nano, Calcirol) are confirmed at their stated concentrations.",
    ageBased: true,
    ageBands: [
      {
        minMonths: 0, maxMonths: 999,
        iuOptions: [
          { label: "Maintenance/prevention: 400 IU once daily (all infants)", iu: 400, freqText: "once daily" },
          { label: "Maintenance, older child: 400-1000 IU once daily", iu: 700, freqText: "once daily" },
          { label: "Treatment (deficiency/rickets): 60,000 IU once weekly x6 doses", iu: 60000, freqText: "once weekly x6 doses" },
          { label: "Treatment, alternative: 3000-6000 IU once daily x12 weeks", iu: 4500, freqText: "once daily x12 weeks" },
        ],
      },
    ],
    isIU: true,
    defaultDurationDays: 42,
    brands: [
      { name: "Nutri-D (400 IU)", manufacturer: "Azveston", strengths: [{ iuPerMl: 400, displayLabel: "400 IU/mL drops" }] },
      { name: "Ultra-D3 drops (400 IU)", manufacturer: "Meyer", strengths: [{ iuPerMl: 400, displayLabel: "400 IU/mL drops" }] },
      { name: "Kidrich-D3 (800 IU)", manufacturer: "Dr Reddy's", strengths: [{ iuPerMl: 800, displayLabel: "800 IU/mL drops" }] },
      { name: "Ultra-D3 syrup", manufacturer: "Meyer", strengths: [{ iuPerMl: 200, displayLabel: "Labeled '1000 IU, 100mL' -- UNVERIFIED whether this means 1000 IU per 5mL (assumed here) or 1000 IU total across the whole 100mL bottle (which would be ~50 IU/5mL, a ~20-fold lower concentration). Market listings only showed the bottle-level title, not a per-5mL figure. CHECK THE PHYSICAL PACK before dosing -- this ambiguity is large enough to matter." }] },
      { name: "Depura (60,000 IU)", manufacturer: "Universal", strengths: [{ iuPerSachet: 60000, displayLabel: "60,000 IU/5mL single dose" }] },
      { name: "Arachitol Nano 60K", manufacturer: "Abbott", strengths: [{ iuPerSachet: 60000, displayLabel: "60,000 IU/5mL nano-emulsion" }] },
      { name: "Gran Calcirol", manufacturer: "Zydus Cadila", strengths: [{ iuPerSachet: 60000, displayLabel: "60,000 IU granule sachet" }] },
    ],
    adminNote: "Once daily for maintenance dosing -- can be placed on the nipple, a spoon, or directly in the mouth; with or without food (absorption is better with a small amount of dietary fat). HIGH-DOSE 60,000 IU SACHET: mix in milk/food, give as the SCHEDULED weekly/fortnightly dose ONLY -- never give it as if it were a daily dose.",
    notes: "Always pair deficiency treatment with calcium. Avoid repeated high boluses (hypercalcemia risk). Match the regimen to the product: 400/800/1000 IU drops and syrup are daily-dosing products; the 60,000 IU sachets (Depura, Arachitol Nano, Calcirol) are weekly/fortnightly-bolus products \u2014 don't cross the two conventions.",
  },
  {
    id: "calcium",
    name: "Calcium (\u00b1 Vitamin D3/Zinc/Magnesium)",
    category: "Vitamin D & Calcium",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Elemental calcium, bone-health/deficiency treatment", low: 50, high: 75, freq: 2, maxDay: 500 },
    ],
    defaultDurationDays: 30,
    brands: [
      { name: "Calcimax+", manufacturer: "Meyer", strengths: [{ mgPer5ml: 250, displayLabel: "Verify exact elemental calcium content on label" }] },
      { name: "Calcimax-P", manufacturer: "Meyer", strengths: [{ mgPer5ml: 250, displayLabel: "Verify exact elemental calcium content on label" }] },
      { name: "Nucalci", manufacturer: "Azveston", strengths: [{ mgPer5ml: 250, displayLabel: "Verify exact elemental calcium content on label" }] },
      { name: "Ossopan D (MCHC)", manufacturer: "TTK", strengths: [{ mgPer5ml: 250, displayLabel: "Microcrystalline hydroxyapatite complex -- verify elemental calcium equivalent" }] },
    ],
    adminNote: "Give WITH FOOD. Separate calcium from iron and from levothyroxine (if applicable) by \u22652h.",
    notes: "Elemental calcium content varies by product (carbonate vs phosphate vs hydroxyapatite complex all have different elemental-calcium yields per mg) -- the strength shown is a placeholder; confirm the actual elemental calcium content on each specific product's label before dosing.",
  },
  {
    id: "vitamin-a",
    name: "Vitamin A (oral \u2014 measles / deficiency)",
    category: "Vitamin D & Calcium",
    topicalOnly: true,
    minAgeMonths: 0,
    sig: "MEASLES (all children, per WHO) \u2014 one age-based dose once daily for 2 CONSECUTIVE DAYS: <6 months = 50,000 IU; 6-11 months = 100,000 IU; \u226512 months = 200,000 IU. Give a THIRD age-specific dose 2-4 weeks later ONLY if clinical signs of vitamin A deficiency (night blindness, Bitot spots, xerophthalmia). Same age-based doses treat deficiency.",
    brands: [
      { name: "Vitamin A oral solution", manufacturer: "Various (national programme)", strengths: [{ displayLabel: "100,000 IU/mL oral solution \u2014 confirm concentration; retinol palmitate" }] },
      { name: "Aquasol A / Arovit", manufacturer: "Various", strengths: [{ displayLabel: "High-dose retinol capsules/solution \u2014 verify IU per unit on the pack" }] },
    ],
    adminNote: "Give orally; better absorbed with a little dietary fat. Give the 2 measles doses on consecutive days \u2014 TWO doses (not one) are what reduce measles mortality and pneumonia-specific mortality in young children. Do not measure serum retinol first. Counsel caregivers this is a short, defined course \u2014 NOT an ongoing daily supplement.",
    precaution: "High single doses \u2014 do NOT give as a repeated daily supplement (hypervitaminosis A: bulging fontanelle/raised ICP in infants, vomiting). Excess vitamin A is teratogenic \u2014 avoid these high doses in possible pregnancy (adolescents).",
    notes: "WHO/AAP recommend vitamin A for all children with acute measles; the 2-day schedule is the mortality-reducing regimen.",
  },
  // ================= CNS / ELECTROLYTE =================
  {
    id: "triclofos",
    name: "Triclofos Sodium",
    category: "CNS / Electrolyte",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Sedation for procedures/EEG/imaging, single dose (monitored)", low: 25, high: 50, freq: 1, maxDay: 2500, singleCourse: true },
    ],
    defaultDurationDays: 1,
    brands: [
      { name: "Pedicloryl", manufacturer: "J", strengths: [{ mgPer5ml: 500 }] },
    ],
    precaution: "Procedural sedation drug \u2014 requires appropriate monitoring (airway, cardiorespiratory), not routine OPD prescribing. CORRECTION: this product is Triclofos sodium, not chloral hydrate as an earlier pass of this project had assumed \u2014 corrected against the confirmed pharmacy formulary composition.",
    notes: "",
  },
  {
    id: "levetiracetam",
    name: "Levetiracetam",
    category: "CNS / Electrolyte",
    topicalOnly: true,
    sig: "NOT AUTO-CALCULATED \u2014 start ~10mg/kg BID, titrate to 20-30mg/kg BID (max ~60mg/kg/day) under specialist direction",
    brands: [
      { name: "Syrp Levipil", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "100mg/mL oral solution" }] },
      { name: "Levepsy", manufacturer: "Cipla", strengths: [{ displayLabel: "100mg/mL oral solution (CORRECTED -- previously mislisted as 100mg/5mL, a 5-fold understatement; actually the same concentration as Levipil)" }, { displayLabel: "500mg tablet" }] },
    ],
    precaution: "Anti-epileptic requiring individualized specialist titration over weeks \u2014 inappropriate for a simple lookup-table dose. This entry exists so the drug isn't silently missing from the pharmacy list, not to calculate its dose.",
    notes: "",
  },
  {
    id: "potassium-chloride",
    name: "Potassium Chloride",
    category: "CNS / Electrolyte",
    minAgeMonths: 0,
    doseOptions: [
      { id: "standard", label: "Hypokalemia, divided doses \u2014 adjust to levels", low: 1, high: 4, freq: 2, maxDay: 200 },
    ],
    defaultDurationDays: 5,
    brands: [
      { name: "Potklor", manufacturer: "Walter Bushnell", strengths: [{ mgPer5ml: 500, displayLabel: "1.5g/15mL \u2248 20mEq K+ per 15mL" }] },
    ],
    precaution: "Dilute, monitor, and adjust to serum potassium levels \u2014 not a fixed empiric regimen.",
    adminNote: "Dilute and give with food to reduce GI irritation.",
    notes: "",
  },
  // ================= ENT / OPHTHALMIC (topical, instruction-only) =================
  {
    id: "saline-nasal",
    name: "Saline Nasal Drops/Spray",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "Instill, wait, then suction/blow; give BEFORE FEEDS in congested infants to aid feeding; unlimited frequency, safe at all ages",
    brands: [{ name: "Nasivion-S", manufacturer: "P&G", strengths: [{ displayLabel: "0.65% buffered isotonic saline" }] }],
  },
  {
    id: "oxymetazoline",
    name: "Oxymetazoline (nasal decongestant)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    discouraged: true,
    sig: "NOT USED IN THIS PRACTICE \u2014 Dr. Gowdar does not give oxymetazoline to children; no dose given",
    brands: [
      { name: "Nasivion Mini (0.01%, infant)", manufacturer: "P&G", strengths: [{ displayLabel: "0.01% -- listed here for recognition only, not for prescribing" }] },
      { name: "Nasivion Paed (0.025%)", manufacturer: "P&G", strengths: [{ displayLabel: "0.025% -- listed here for recognition only, not for prescribing" }] },
    ],
    precaution: "By this practice's own convention, oxymetazoline is not given to children regardless of age/strength -- this aligns with the FDA's own stricter 6-year labeled minimum and the cardiovascular-risk concern in young children (Cartabuke et al., AAP, 2021). Saline nasal drops/spray (elsewhere in this app) are the default alternative for congestion.",
    notes: "",
  },
  {
    id: "cipro-eye",
    name: "Ciprofloxacin (eye/ear drops)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    minAgeMonths: 12,
    sig: "Eye: 1-2 drops per label frequency, \u22651yr. Otic (with dexamethasone): 4 drops BID",
    brands: [
      { name: "Ciplox", manufacturer: "Cipla", strengths: [{ displayLabel: "0.3% ophthalmic" }] },
      { name: "Ciplox-D (+Dexamethasone 0.1%)", manufacturer: "Cipla", strengths: [{ displayLabel: "0.3% + 0.1% ophthalmic/otic" }] },
    ],
    adminNote: "Eye: wash hands, pull down lower lid, instill 1 drop into the conjunctival sac, avoid touching the tip to the eye/lashes; if using \u22652 eye products, wait ~5 min between them; press the inner corner of the eye (punctal occlusion) ~1 min to limit systemic absorption. Ear: warm the bottle in hand; child lying with affected ear up; instill, keep ear up ~5 min; DO NOT USE if the eardrum is perforated/has grommets unless the product is specifically labeled non-ototoxic.",
  },
  {
    id: "moxifloxacin-eye",
    name: "Moxifloxacin (eye drops)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    minAgeMonths: 12,
    sig: "1 drop TID, \u22651yr (often used younger in practice)",
    brands: [{ name: "Moxicip", manufacturer: "Cipla", strengths: [{ displayLabel: "0.5% w/v" }] }],
  },
  {
    id: "tobramycin-eye",
    name: "Tobramycin (eye drops)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "1-2 drops Q4h",
    brands: [{ name: "Toba", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "0.3% w/v" }] }],
  },
  {
    id: "artificial-tears",
    name: "Artificial Tears / Lubricants",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "As needed for dry eye/ocular surface lubrication",
    brands: [{ name: "Refresh Tears", manufacturer: "Allergan", strengths: [{ displayLabel: "Carboxymethylcellulose 0.5%" }] }],
  },
  {
    id: "clinician-only-eye",
    name: "Clinician-Administered Eye Drops (mydriatic/anesthetic)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "CLINICIAN-ADMINISTERED ONLY \u2014 not for family/home use",
    brands: [
      { name: "Paracain (Proparacaine 0.5%)", manufacturer: "Sunways", strengths: [{ displayLabel: "Topical anesthesia for procedures" }] },
      { name: "Itrop Plus (Tropicamide 0.8% + Phenylephrine 5%)", manufacturer: "Cipla", strengths: [{ displayLabel: "Mydriasis for fundus exam" }] },
    ],
    precaution: "Itrop Plus: caution for systemic phenylephrine absorption in infants during fundus exams.",
  },
  {
    id: "ear-combo",
    name: "Ear Combination Drops (antibiotic/ceruminolytic)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "Per label -- not weight-dosed. Do not use if tympanic membrane perforated/grommets present unless specifically labeled non-ototoxic",
    brands: [
      { name: "Otogesic (Polymyxin B + Chloramphenicol + Benzocaine + Hydrocortisone)", manufacturer: "Strides", strengths: [{ displayLabel: "" }] },
      { name: "Otorex / Soliwax (Paradichlorobenzene + Benzocaine + Chlorbutol + Turpentine oil)", manufacturer: "Indoco / Nulife", strengths: [{ displayLabel: "Ceruminolytic (wax-dissolving)" }] },
    ],
    precaution: "Benzocaine carries a methemoglobinemia risk -- avoid in a perforated eardrum.",
  },
  {
    id: "sinarest-family",
    name: "Sinarest range (Paracetamol/Phenylephrine/Chlorpheniramine combinations)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    discouraged: true,
    sig: "NOT RECOMMENDED under 4 years \u2014 no dose given",
    brands: [
      { name: "Sinarest Plus / Sinarest Syr / Sinarest Paediatric", manufacturer: "Centaur", strengths: [{ displayLabel: "Paracetamol + Phenylephrine + Chlorpheniramine, varying ratios" }] },
      { name: "Sinarest-AF (antipyretic-free)", manufacturer: "Centaur", strengths: [{ displayLabel: "Phenylephrine + Chlorpheniramine" }] },
      { name: "Ocurest-AH (eye drops)", manufacturer: "Centaur", strengths: [{ displayLabel: "Phenylephrine + Naphazoline + Chlorpheniramine" }] },
    ],
    precaution: "Same class caution as the respiratory cough-cold FDCs: oral phenylephrine is an ineffective decongestant at labeled doses, and combination antipyretic/antihistamine/decongestant products are not recommended under 4 years per FDA/AAP. If fever/pain relief is needed, use plain paracetamol or ibuprofen from this app instead and treat congestion separately with saline.",
    notes: "",
  },
  // ================= TOPICAL DERMATOLOGICAL =================
  {
    id: "topical-steroid",
    name: "Topical Corticosteroids (single agent)",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "Apply a THIN FILM to affected skin only, 1-2x/day, using the fingertip-unit method",
    brands: [
      { name: "Atonide (Desonide 0.05%)", manufacturer: "Torrent", strengths: [{ displayLabel: "Low potency, labeled \u22653 months" }] },
      { name: "Desowen (Desonide 0.05%)", manufacturer: "Various", strengths: [{ displayLabel: "Low potency, labeled \u22653 months" }] },
      { name: "Crea Lycor (Hydrocortisone 1%)", manufacturer: "Micro Labs", strengths: [{ displayLabel: "Low potency, FDA-labeled \u22652yr (widely used off-label younger)" }] },
      { name: "Eumosone (Clobetasone butyrate 0.05%)", manufacturer: "GSK", strengths: [{ displayLabel: "Mild steroid despite the name -- useful step-down agent" }] },
      { name: "Flutivate (Fluticasone propionate 0.05%)", manufacturer: "GSK", strengths: [{ displayLabel: "Moderate potency; studied 3 months-18yr; twice-weekly 'weekend therapy' reduces flare recurrence" }] },
      { name: "Momate (Mometasone furoate)", manufacturer: "Glenmark", strengths: [{ displayLabel: "Medium potency, labeled \u22652yr, once daily" }] },
    ],
    sourceNote: "Per-agent age floors cross-checked against the age/weight cutoffs document's explicit FDA table (Freeze et al., Pediatr Dermatol, 2021; Davis et al., AAD, 2026): Desonide/Fluocinolone 3mo+, Alclometasone 1yr+, Hydrocortisone/Mometasone 2yr+, Desoximetasone 10yr+, Clobetasol/Halobetasol 12yr+, Betamethasone 13yr+. None of the stocked brands here are the higher-potency agents in that table (desoximetasone/clobetasol/betamethasone/halobetasol), so the age floors already shown per-brand above remain the relevant ones. That source also notes off-label use is common even for these (hydrocortisone 43%, clobetasol 34% off-label by age) with adverse effects occurring even within labeled ranges -- match potency to age and site regardless of label technicalities.",
    adminNote: "Rub in gently. Apply emollient FIRST, or wait ~15-30 min between emollient and steroid. Lotions: shake well before use. Avoid occlusion and thin-skin sites (face/flexures/genitals) unless a low-potency agent is specifically chosen. Wash hands after application.",
    precaution: "General principle: use the LOWEST effective potency, short durations. Higher-potency agents and thin-skin sites raise the risk of atrophy and systemic absorption -- children have a higher surface-to-weight ratio than adults, amplifying this risk.",
    notes: "",
  },
  {
    id: "topical-steroid-fdc",
    name: "Topical Steroid + Antifungal \u00b1 Antibiotic FDCs",
    category: "Topical Dermatological",
    topicalOnly: true,
    discouraged: true,
    sig: "GENERALLY DISCOURAGED \u2014 prefer single agents",
    brands: [
      { name: "Candiderma Plus (Beclomethasone + Clotrimazole + Neomycin)", manufacturer: "Glenmark", strengths: [{ displayLabel: "" }] },
      { name: "Crea Candid-B (Clotrimazole + Beclomethasone)", manufacturer: "Glenmark", strengths: [{ displayLabel: "" }] },
      { name: "Eumosone-M (Clobetasone + Miconazole)", manufacturer: "GSK", strengths: [{ displayLabel: "" }] },
      { name: "Fucibet (Fusidic acid + Betamethasone)", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "" }] },
      { name: "Momate-F (Mometasone + Fusidic acid)", manufacturer: "Glenmark", strengths: [{ displayLabel: "" }] },
      { name: "Candid-CL (Clindamycin + Clotrimazole)", manufacturer: "Glenmark", strengths: [{ displayLabel: "" }] },
    ],
    precaution: "Per the uploaded reference: a steroid on an undiagnosed fungal infection can worsen it (tinea incognito), and neomycin sensitizes. Short-term use (\u22641-2 weeks) if used at all, to limit resistance and steroid effects. Prefer single-agent antifungal or antibiotic once any inflammation has settled, rather than defaulting to the combination product.",
    notes: "",
  },
  {
    id: "topical-antifungal",
    name: "Topical Antifungals (single agent)",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "Apply to the lesion and ~2cm of surrounding normal skin, 1-2x/day for 2-4 weeks; CONTINUE 1-2 weeks after clinical clearance to prevent relapse",
    brands: [
      { name: "Candid (Clotrimazole 1%)", manufacturer: "Glenmark", strengths: [{ displayLabel: "Cream/lotion/mouthpaint -- safe in infants" }] },
    ],
    sourceNote: "CORRECTION: Candid-V (Clotrimazole 2%) removed from this skin-antifungal entry -- it is a VAGINAL gel/pessary, not a topical skin product, and isn't a pediatric OPD-relevant formulation. This app previously listed it here as if it were simply a higher-strength skin cream, which was wrong.",
  },
  {
    id: "topical-antibiotic",
    name: "Topical Antibiotics / Antiseptics (single agent)",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "See brand notes -- frequency varies by product",
    brands: [
      { name: "Bactibade / Oint T-Bact (Mupirocin 2%)", manufacturer: "Aequitas / GSK", strengths: [{ displayLabel: "Apply 3x/day up to 10 days for impetigo/secondarily infected wounds" }] },
      { name: "Oint Betadine (Povidone-iodine 10%)", manufacturer: "Win Medicare", strengths: [{ displayLabel: "Apply to affected area; use cautiously over large areas/prolonged use in neonates (systemic iodine absorption, thyroid effects)" }] },
      { name: "Silverex Ionic (0.2% gel)", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "Apply thin layer 1-2x/day; limited high-quality pediatric data" }] },
      { name: "Metrogel / Metrogyl P (Metronidazole \u00b1 povidone-iodine)", manufacturer: "Galderma / JB", strengths: [{ displayLabel: "Apply 1-2x/day; rosacea is uncommon in children -- confirm indication" }] },
    ],
  },
  {
    id: "emollients-topical",
    name: "Emollients, Barrier & Cleanser Products",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "Apply LIBERALLY and FREQUENTLY (several times daily and after bathing), in the direction of hair growth; use within 3 min of patting dry ('soak-and-seal'); use a pump/spatula, not fingers into a tub, to avoid contaminating the product",
    brands: [
      { name: "Baby Moisturiser", manufacturer: "Equalstwo", strengths: [{ displayLabel: "Cetyl/stearyl alcohol, glycerin, shea butter emollient base" }] },
      { name: "Cerlo Cream", manufacturer: "Neuva Lifesciences", strengths: [{ displayLabel: "Ceramides + cholesterol + free fatty acids + hyaluronic acid -- barrier-repair" }] },
      { name: "Moisturex Soft (cream/lotion)", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "White soft paraffin + light liquid paraffin -- occlusive, gentle" }] },
      { name: "Moisturex Calm Lotion", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "" }] },
      { name: "Moisturex Syndet Bathing Bar", manufacturer: "Rexcin", strengths: [{ displayLabel: "Syndet base, soap-free, near-physiologic pH" }] },
      { name: "Physiogel range", manufacturer: "GSK", strengths: [{ displayLabel: "BioMimic lipids + glycerin -- barrier-repair moisturizer" }] },
      { name: "Ritch Creamy", manufacturer: "Curatio", strengths: [{ displayLabel: "SymCalmin + shea butter + aloe vera -- soothing anti-itch emollient" }] },
      { name: "Crea Nipcare (Purified lanolin)", manufacturer: "Neon", strengths: [{ displayLabel: "Nipple/lip/dry-skin protectant \u2014 caution: lanolin allergy" }] },
      { name: "VC Oil", manufacturer: "Neuva Lifesciences", strengths: [{ displayLabel: "Emollient oil" }] },
      { name: "Venusia Baby Intensive Moisturizing", manufacturer: "Dr Reddy's", strengths: [{ displayLabel: "Lotion" }] },
      { name: "Smuth", manufacturer: "Aristo", strengths: [{ displayLabel: "Emollient cream" }] },
      { name: "Spoo (shampoo)", manufacturer: "Torrent", strengths: [{ displayLabel: "Gentle cleanser" }] },
    ],
    notes: "No fixed dose -- used liberally as often as needed. Core role: maintain skin barrier in atopic dermatitis, xerosis, and diaper care.",
  },
  {
    id: "antipruritic-topical",
    name: "Antipruritic / Calamine / Diaper Products",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "As needed; see brand notes for specific cautions",
    brands: [
      { name: "Calosoft AF (Calamine + Aloe vera + Liquid paraffin)", manufacturer: "Micro Labs", strengths: [{ displayLabel: "As needed for pruritus/mild rashes" }] },
      { name: "Lotn Calapure-A", manufacturer: "Mankind", strengths: [{ displayLabel: "Calamine-based" }] },
      { name: "Lotn Dermocalm", manufacturer: "GSK", strengths: [{ displayLabel: "Calamine + liquid paraffin + aloe vera" }] },
      { name: "B4 Nappi (Zinc oxide + Calendula oil + Allantoin)", manufacturer: "Torrent", strengths: [{ displayLabel: "Apply a thick layer at EACH diaper change to clean, dry skin" }] },
      { name: "Crea Anovate (Phenylephrine + Beclomethasone + Lidocaine)", manufacturer: "USV", strengths: [{ displayLabel: "Anorectal anti-inflammatory cream -- confirm indication before use" }] },
    ],
    sourceNote: "CORRECTIONS confirmed against manufacturer/market listings: B4 Nappi contains NO antifungal (this app previously wrongly listed miconazole) -- corrected to its actual actives. Prilox-5 and Zytee-RB were also previously miscategorized here with wrong compositions entirely -- both moved to their own correctly-described entries elsewhere, since they are not calamine-family antipruritics at all.",
  },
  {
    id: "prilox-anesthetic",
    name: "Prilox-5 (Lidocaine + Prilocaine, topical anesthetic)",
    category: "Topical Dermatological",
    topicalOnly: true,
    sig: "Apply a thick layer to intact skin under occlusion 45-60 min before a painful procedure (venipuncture, minor skin procedure); remove before the procedure",
    brands: [{ name: "Prilox-5", manufacturer: "Neon", strengths: [{ displayLabel: "Lidocaine 2.5% + Prilocaine 2.5% cream (EMLA-type local anesthetic)" }] }],
    precaution: "CORRECTION: this app previously listed Prilox-5 as a calamine+phenol+zinc oxide antipruritic, which was entirely wrong -- it is actually a lidocaine+prilocaine local anesthetic cream, and the phenol precaution that used to be attached to it does not apply. The real safety concern is different: PRILOCAINE carries a methemoglobinemia risk in infants, particularly under 3 months, with prolonged contact time, large application area, or concurrent methemoglobinemia-inducing drugs. Use the smallest effective area and shortest necessary contact time in young infants.",
    notes: "",
  },
  {
    id: "zytee-oral-gel",
    name: "Zytee-RB (Choline salicylate + Benzalkonium chloride, oral mucosa gel)",
    category: "ENT / Ophthalmic",
    topicalOnly: true,
    sig: "Apply a small amount to the affected oral mucosa (mouth ulcers, teething) up to 3-4x/day",
    brands: [{ name: "Zytee-RB", manufacturer: "Raptakos", strengths: [{ displayLabel: "Choline salicylate 9% + Benzalkonium chloride 0.02% gel" }] }],
    precaution: "CORRECTION: this app previously listed Zytee-RB as a Pramoxine+Calamine/Zinc skin product to 'apply to intact skin' -- that was wrong. It is an ORAL MUCOSA gel (mouth ulcers/teething), not a skin product at all. Some retail listings state it should not be used under 16 years -- salicylate exposure in a young child is worth weighing carefully (Reye syndrome association with salicylates generally); confirm current age guidance against the product insert before using for teething in an infant.",
    notes: "",
  },
  {
    id: "scabies-anesthetic-topical",
    name: "Scabies / Topical Anesthetics / Musculoskeletal",
    category: "Topical Dermatological",
    topicalOnly: true,
    minAgeMonths: 2,
    sig: "Permethrin quantity by age: 2mo-1yr \u2248 3.75g; 1-5yr \u2248 7.5g; 6-12yr \u2248 15g; >12yr \u2248 30g. Apply neck-down (whole head-to-body in infants/young children) to cool dry skin, leave 8-14h overnight, wash off, reapply to hands after washing, treat close contacts simultaneously, repeat in 7-14 days",
    brands: [
      { name: "Permite (Permethrin 5%)", manufacturer: "Torrent", strengths: [{ displayLabel: "First-line for scabies/lice, \u22652 months. 60g tube -- roughly 2 full-body applications for an adolescent/adult, or several for an infant" }] },
      { name: "Lox / Lox-2% (Lignocaine)", manufacturer: "Neon", strengths: [{ displayLabel: "Topical anesthetic spray/jelly" }] },
      { name: "Volini (Diclofenac spray)", manufacturer: "Sun Pharma", strengths: [{ displayLabel: "Musculoskeletal pain -- confirm age-appropriateness before use" }] },
    ],
    sourceNote: "Age-based quantity table added from the age/weight cutoffs document (FDA permethrin label; Chiriac et al., Eur J Pediatr, 2024) -- previously this app gave only the application technique, not how much product a course actually needs.",
    notes: "",
  },
];

const CATEGORY_ORDER = [
  "Emergency / Resuscitation",
  "Antibiotics / Antivirals / Antiparasitics",
  "Antihistamines",
  "Analgesics / Antipyretics / Steroids",
  "Respiratory",
  "Gastrointestinal",
  "Iron",
  "Vitamin D & Calcium",
  "CNS / Electrolyte",
  "ENT / Ophthalmic",
  "Topical Dermatological",
];

function round(n, step) {
  // Snap to the step, then clean floating-point noise (e.g. 23 * 0.1 = 2.3000000000000003)
  // so volumes never show more than 1 decimal place.
  return Math.round((Math.round(n / step) * step) * 10) / 10;
}

function roundVolume(ml) {
  if (ml <= 0) return 0;
  if (ml < 2.5) return round(ml, 0.1);
  if (ml < 10) return round(ml, 0.5);
  return round(ml, 1);
}

function strengthLabel(s) {
  if (s.displayLabel) return s.displayLabel;
  if (s.mgPer5ml) return `${s.mgPer5ml} mg/5 mL`;
  if (s.mgPerMl) return `${s.mgPerMl} mg/mL`;
  if (s.tabletMg) return `${s.tabletMg} mg`;
  if (s.gramsPerSachet) return `${s.gramsPerSachet} g/sachet`;
  if (s.iuPerMl) return `${s.iuPerMl} IU/mL`;
  if (s.iuPerSachet) return `${s.iuPerSachet} IU/sachet`;
  return "";
}

const ROUTE_OVERRIDES = {
  "saline-nasal": "Nasal",
  "oxymetazoline": "Nasal",
  "cipro-eye": "Ophthalmic / Otic (per product -- see brand)",
  "moxifloxacin-eye": "Ophthalmic",
  "tobramycin-eye": "Ophthalmic",
  "artificial-tears": "Ophthalmic",
  "clinician-only-eye": "Ophthalmic (clinician-administered only)",
  "ear-combo": "Otic",
  "sinarest-family": "Oral / Ophthalmic (see specific brand)",
  "olopatadine": "Ophthalmic",
  "salbutamol-neb": "Nebulized / Inhaled",
  "budesonide-neb": "Nebulized",
  "ipratropium-neb": "Nebulized / Inhaled",
  "intranasal-steroid": "Nasal",
  "nystatin-oral": "Oral (swish/paint)",
  "epinephrine-im": "Intramuscular (anterolateral thigh)",
  "vitamin-a": "Oral",
  "artemether-lumefantrine": "Oral",
};

function getRoute(drug) {
  if (ROUTE_OVERRIDES[drug.id]) return ROUTE_OVERRIDES[drug.id];
  if (drug.category === "Topical Dermatological") return "Topical";
  return "Oral";
}

function sigToClockTimes(sig) {
  if (!sig) return "";
  if (/PRN|as needed/i.test(sig)) return "PRN (as needed) \u2014 space per interval";
  if (/QID|four times daily|\u00f74/i.test(sig)) return "8:00 AM, 12:00 PM, 4:00 PM & 8:00 PM";
  if (/TID|three times daily|3x\/day|Q8h|\u00f73/i.test(sig)) return "8:00 AM, 2:00 PM & 8:00 PM";
  if (/BID|twice daily|Q12h|\u00f72|\u00f7Q12h/i.test(sig)) return "8:00 AM & 8:00 PM";
  if (/once daily|single dose|x1\b/i.test(sig)) return "8:00 AM";
  return "Space doses evenly per Sig";
}

// Self-contained PDF writer -- no external library, no network request, no injected <script>,
// so there is nothing here for a Content-Security-Policy to block. Writes a minimal but valid
// PDF (Helvetica / Helvetica-Bold, the standard 14 fonts every PDF viewer already has built in)
// using only string-building and the browser's built-in Blob/URL APIs.
function pdfEscape(s) {
  return String(s)
    .replace(/\u2014/g, "-").replace(/\u2013/g, "-")
    .replace(/\u00d7/g, "x").replace(/\u00f7/g, "/")
    .replace(/\u2264/g, "<=").replace(/\u2265/g, ">=")
    .replace(/\u26a0/g, "/!\\").replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function estimateWidth(text, size, bold) {
  return String(text).length * size * (bold ? 0.6 : 0.5);
}

function wrapPlainText(text, maxWidth, size, bold) {
  const words = String(text).split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const test = current ? current + " " + word : word;
    if (current && estimateWidth(test, size, bold) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdfBlob(items) {
  const PAGE_W = 595, PAGE_H = 842; 
  const pages = [[]];
  items.forEach((item) => {
    if (item.pageBreak) pages.push([]);
    else pages[pages.length - 1].push(item);
  });
  const objects = []; 
  const fontRegId = 3, fontBoldId = 4;
  objects.push({ id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" });
  const pageIds = pages.map((_, i) => 5 + i * 2);
  const contentIds = pages.map((_, i) => 6 + i * 2);
  objects.push({ id: 2, body: `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>` });
  objects.push({ id: fontRegId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" });
  objects.push({ id: fontBoldId, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>" });
  pages.forEach((pageItems, i) => {
    let stream = "BT\n";
    pageItems.forEach((it) => {
      stream += `/${it.bold ? "F2" : "F1"} ${it.size} Tf\n1 0 0 1 ${it.x.toFixed(2)} ${it.y.toFixed(2)} Tm\n(${pdfEscape(it.text)}) Tj\n`;
    });
    stream += "ET";
    objects.push({ id: contentIds[i], stream });
    objects.push({ id: pageIds[i], body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>` });
  });
  objects.sort((a, b) => a.id - b.id);
  let pdf = "%PDF-1.4\n";
  const offsets = {};
  objects.forEach((obj) => {
    offsets[obj.id] = pdf.length;
    if (obj.stream != null) {
      pdf += `${obj.id} 0 obj\n<< /Length ${obj.stream.length} >>\nstream\n${obj.stream}\nendstream\nendobj\n`;
    } else {
      pdf += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
    }
  });
  const xrefStart = pdf.length;
  const maxId = Math.max(...objects.map((o) => o.id));
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const off = offsets[id] != null ? offsets[id] : 0;
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadRxPDF(rows, calc, patientName, sex, ageLabel, weight, heightCm, ageMonths) {
  const marginLeft = 48, marginRight = 48, topStart = 56, bottomLimit = 794; 
  const maxWidth = 595 - marginLeft - marginRight;
  const items = [];
  let y = topStart;
  
  function ensureSpace(needed) {
    if (y + needed > bottomLimit) {
      items.push({ pageBreak: true });
      y = topStart;
    }
  }
  
  function writeLine(text, opts = {}) {
    const size = opts.size || 10;
    const bold = opts.bold || false;
    const gapAfter = opts.gapAfter != null ? opts.gapAfter : size * 1.4;
    const wrapped = wrapPlainText(text, maxWidth, size, bold);
    wrapped.forEach((line) => {
      ensureSpace(size * 1.4);
      items.push({ text: line, x: marginLeft, y: 842 - y, size, bold });
      y += size * 1.4;
    });
    y += gapAfter - size * 1.4;
  }
  
  writeLine("Prescription", { size: 16, bold: true, gapAfter: 10 });
  writeLine(new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), { size: 10, gapAfter: 14 });
  if (patientName) writeLine(`Name: ${patientName}`, { size: 11 });
  if (sex) writeLine(`Sex: ${sex === "male" ? "Male" : "Female"}`, { size: 11 });
  if (ageLabel) writeLine(`Age: ${ageLabel}`, { size: 11 });
  if (weight) writeLine(`Weight: ${weight} kg`, { size: 11 });
  if (heightCm) writeLine(`${ageMonths !== null && ageMonths < 24 ? "Length" : "Height"}: ${heightCm} cm`, { size: 11, gapAfter: 18 });
  else y += 8;
  
  writeLine("Rx", { size: 14, bold: true, gapAfter: 14 });
  rows.forEach((row, idx) => {
    const result = calc(row);
    if (result.error || result.belowAge || result.belowWeight) return;
    const route = getRoute(result.drug);
    const clockTimes = sigToClockTimes(result.sig);
    
    writeLine(`${idx + 1}. ${result.drug.discouraged ? "[DISCOURAGED] " : ""}${result.brand.name} - ${strengthLabel(result.strength)}`, { size: 11, bold: true, gapAfter: 6 });
    if (result.doseText) writeLine(`Dose derivation: ${result.formula || result.doseText}`, { size: 9, gapAfter: 5 });
    writeLine(`Sig: ${result.sig}`, { size: 10, gapAfter: 5 });
    
    let infoLine = `Frequency: ${clockTimes}  |  Route: ${route}`;
    if (!result.drug.topicalOnly && !result.isSingleCourse) infoLine += `  |  Duration: ${row.durationDays} days`;
    if (result.totalVolMl) infoLine += `  |  Dispense: ~${result.totalVolMl} mL`;
    
    writeLine(infoLine, { size: 9, gapAfter: 5 });
    if (result.drug.adminNote) writeLine(`Administration: ${result.drug.adminNote}`, { size: 9, gapAfter: 5 });
    if (result.precaution) writeLine(`/!\\ ${result.precaution}`, { size: 9, gapAfter: 5 });
    y += 8;
  });
  
  ensureSpace(60);
  y += 36;
  writeLine("Signature: ______________________", { size: 9 });
  
  try {
    const blob = buildPdfBlob(items);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription${patientName ? "-" + patientName.replace(/[^a-z0-9]+/gi, "_") : ""}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    window.alert("Could not generate PDF: " + err.message + "\n\nTry the Copy to clipboard button instead and paste into a document.");
  }
}

function copyRxText(rows, calc, patientName, sex, ageLabel, weight, heightCm, ageMonths) {
  const hasRowErrors = rows.some((r) => {
    const res = calc(r);
    return res.error || (!res.drug.topicalOnly && !(ageMonths !== null && weight !== null && weight > 0));
  });
  
  if (hasRowErrors) {
    window.alert("Please resolve dosing or patient parameter errors before copying the prescription.");
    return;
  }
  
  const lines = [];
  if (patientName) lines.push(`Name: ${patientName}`);
  if (sex) lines.push(`Sex: ${sex === "male" ? "Male" : "Female"}`);
  if (ageLabel) lines.push(`Age: ${ageLabel}`);
  if (weight) lines.push(`Weight: ${weight} kg`);
  if (heightCm) lines.push(`${ageMonths !== null && ageMonths < 24 ? "Length" : "Height"}: ${heightCm} cm`);
  if (lines.length) lines.push("");
  
  rows.forEach((row, idx) => {
    const result = calc(row);
    if (result.error || result.belowAge || result.belowWeight) return;
    const route = getRoute(result.drug);
    const clockTimes = sigToClockTimes(result.sig);
    
    lines.push(`${idx + 1}. ${result.drug.discouraged ? "[DISCOURAGED] " : ""}${result.brand.name} \u2014 ${strengthLabel(result.strength)}`);
    if (result.doseText) lines.push(`   Dose derivation: ${result.formula || result.doseText}`);
    lines.push(`   Sig: ${result.sig}`);
    
    let infoLine = `   Frequency (clock times): ${clockTimes}  |  Route: ${route}`;
    if (!result.drug.topicalOnly && !result.isSingleCourse) infoLine += `  |  Duration: ${row.durationDays} days`;
    if (result.totalVolMl) infoLine += `  |  Dispense: ~${result.totalVolMl} mL`;
    
    lines.push(infoLine);
    if (result.drug.adminNote) lines.push(`   Administration & counseling: ${result.drug.adminNote}`);
    if (result.precaution) lines.push(`   \u26a0 ${result.precaution}`);
    lines.push("");
  });
  
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      window.prompt("Copy failed -- select and copy manually:", text);
    });
  } else {
    window.prompt("Select and copy:", text);
  }
}

function sliderStep(low, high, isGramDose) {
  const span = Math.abs(high - low);
  if (span === 0) return isGramDose ? 0.1 : 0.5;
  const rawStep = span / 50;
  const niceSteps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];
  for (const s of niceSteps) {
    if (rawStep <= s) return s;
  }
  return 100;
}

function midpoint(opt) {
  const low = opt.low != null ? opt.low : opt.lowDose;
  const high = opt.high != null ? opt.high : opt.highDose;
  return Math.round(((low + high) / 2) * 10) / 10;
}

function amountToUnits(amount, strength, unit) {
  if (unit === "g") {
    if (strength.gramsPerSachet) {
      const sachets = amount / strength.gramsPerSachet;
      return { text: sachets === 1 ? "1 sachet" : `${Math.round(sachets * 10) / 10} sachets`, raw: sachets };
    }
    return null;
  }
  if (unit === "IU") {
    if (strength.iuPerMl) {
      const ml = roundVolume(amount / strength.iuPerMl);
      return { text: `${ml} mL`, raw: ml };
    }
    if (strength.iuPerSachet) {
      const sachets = amount / strength.iuPerSachet;
      return { text: sachets === 1 ? "1 sachet" : `${Math.round(sachets * 10) / 10} sachets`, raw: sachets };
    }
    return null;
  }
  if (strength.mgPer5ml) {
    const ml = roundVolume((amount / strength.mgPer5ml) * 5);
    return { text: `${ml} mL`, raw: ml };
  }
  if (strength.mgPerMl) {
    const ml = roundVolume(amount / strength.mgPerMl);
    return { text: `${ml} mL`, raw: ml };
  }
  if (strength.tabletMg) {
    const count = amount / strength.tabletMg;
    const rounded = Math.round(count * 2) / 2;
    return { text: rounded === 1 ? "1 unit" : `${rounded} units`, raw: rounded };
  }
  return null;
}

// Local-time YYYY-MM-DD (used as the max value of the date-of-birth picker)
function toISODateLocal(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
// Completed months + days between a date of birth (YYYY-MM-DD) and today.
// Returns null if no DOB, { invalid: true } if unparseable or in the future.
function calcAgeFromDob(dobStr, now) {
  if (!dobStr) return null;
  const parts = dobStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return { invalid: true };
  const [y, m, d] = parts;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birth = new Date(y, m - 1, d);
  if (birth > today) return { invalid: true };
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() - (m - 1));
  if (today.getDate() < d) months -= 1;
  // days since the last completed-month anniversary (clamped for short months)
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
  const anniv = new Date(y, m - 1 + months, Math.min(d, lastDay));
  const days = Math.round((today - anniv) / 86400000);
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  let label;
  if (months < 1) label = plural(days, "day");
  else if (months < 12) label = plural(months, "month") + (days > 0 ? ` ${plural(days, "day")}` : "");
  else label = plural(yrs, "year") + (mo > 0 ? ` ${plural(mo, "month")}` : "");
  return { months, days, label };
}
export default function RxCalculator() {
  const [patientName, setPatientName] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [ageUnit, setAgeUnit] = useState("months");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [rows, setRows] = useState([]);
  const [drugToAdd, setDrugToAdd] = useState("");
  const [errors, setErrors] = useState({});

  // Age from date of birth, calculated against today's date every render
  const dobInfo = calcAgeFromDob(dob, new Date());
  const dobMonths = dobInfo && !dobInfo.invalid ? dobInfo.months : null;
  const ageMonths = useMemo(() => {
    if (dob) return dobMonths; // DOB entered: it overrides the manual age fields
    const v = parseFloat(ageValue);
    if (isNaN(v) || v < 0) return null;
    return ageUnit === "years" ? v * 12 : v;
  }, [dob, dobMonths, ageValue, ageUnit]);
  // Text shown on the prescription / PDF / copied text
  const ageLabel = dob ? (dobMonths !== null ? dobInfo.label : "") : (ageValue ? `${ageValue} ${ageUnit}` : "");
  
  const weightKg = useMemo(() => {
    const v = parseFloat(weight);
    if (isNaN(v) || v <= 0) return null;
    return v;
  }, [weight]);
  
  const patientValid = ageMonths !== null && weightKg !== null;

  function addDrug() {
    if (!drugToAdd) return;
    const drug = DRUGS.find((d) => d.id === drugToAdd);
    if (rows.some((r) => r.drugId === drugToAdd)) {
      setDrugToAdd("");
      return;
    }
    const firstOpt = drug.doseOptions ? drug.doseOptions[0] : null;
    const initialMgPerKg = firstOpt ? midpoint(firstOpt) : null;
    
    setRows((prev) => [
      ...prev,
      {
        rowId: `${drugToAdd}-${Date.now()}`,
        drugId: drugToAdd,
        doseOptionId: firstOpt ? firstOpt.id : null,
        mgPerKg: initialMgPerKg,
        brandIdx: 0,
        strengthIdx: 0,
        durationDays: drug.defaultDurationDays || 5,
        iuOptionIdx: 0,
        dosingMode: "weightband",
      },
    ]);
    setDrugToAdd("");
  }

  function changeDoseOption(rowId, newOptionId, drug) {
    const opt = drug.doseOptions.find((o) => o.id === newOptionId);
    updateRow(rowId, { doseOptionId: newOptionId, mgPerKg: midpoint(opt) });
  }

  function removeRow(rowId) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  function updateRow(rowId, patch) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function calc(row) {
    const drug = DRUGS.find((d) => d.id === row.drugId);
    const brand = drug.brands[row.brandIdx];
    const strength = brand.strengths[row.strengthIdx] || brand.strengths[0];
    const belowAge = ageMonths !== null && drug.minAgeMonths != null && ageMonths < drug.minAgeMonths;
    const belowWeight = weightKg !== null && drug.minWeightKg != null && weightKg < drug.minWeightKg;
    const isLiquid = Boolean(strength.mgPer5ml || strength.mgPerMl || strength.iuPerMl);
    
    const base = { 
      drug, brand, strength, belowAge, belowWeight, 
      sourceNote: drug.sourceNote, precaution: drug.precaution,
      isSingleCourse: false 
    };

    // ---- Topical / instruction-only (includes discouraged items) ----
    if (drug.topicalOnly) {
      return { ...base, sig: drug.sig, doseText: null, isSingleCourse: true };
    }

    // ---- Age-banded ----
    if (drug.ageBased) {
      const band = drug.ageBands.find((b) => ageMonths >= b.minMonths && ageMonths <= b.maxMonths);
      if (!band) return { ...base, error: "No matching age band for entered age." };
      
      const isSingleCourse = (band.freqText && band.freqText.includes("single dose"));
      
      if (drug.isIU) {
        const opts = band.iuOptions;
        const idx = row.iuOptionIdx || 0;
        const chosen = opts[idx] || opts[0];
        const units = amountToUnits(chosen.iu, strength, "IU");
        const chosenSingle = chosen.freqText && chosen.freqText.includes("single dose");
        return {
          ...base,
          sig: units ? `${units.text} ${chosen.freqText || "once daily"}` : "Select a matching brand/strength",
          doseText: chosen.label,
          iuOptions: opts,
          isSingleCourse: chosenSingle
        };
      }
      
      const mgMatch = band.label.match(/([\d.]+)(?:-([\d.]+))?\s*mg/);
      const mg = mgMatch ? parseFloat(mgMatch[2] || mgMatch[1]) : null;
      const units = mg != null ? amountToUnits(mg, strength, "mg") : null;
      return {
        ...base,
        sig: units ? `${units.text} ${band.freqText || "once daily"}` : band.label,
        doseText: band.label,
        isSingleCourse
      };
    }

    // ---- Weight-band table ----
    const hasDualMode = drug.weightBandTable && drug.doseOptions;
    const useWeightBand = drug.weightBandTable && (!hasDualMode || row.dosingMode !== "weightband" === false); // fallback strictly to weightband

    if (useWeightBand) {
      if (!weightKg) return { ...base, error: "Enter patient weight." };
      
      if (drug.ageBandsUnder1 && ageMonths !== null && ageMonths < 12) {
        const band = drug.ageBandsUnder1.find((b) => ageMonths >= b.minMonths && ageMonths <= b.maxMonths);
        if (band && band.isPerKg) {
          const mg = Math.round(band.mgPerKg * weightKg * 10) / 10;
          const units = amountToUnits(mg, strength, "mg");
          return {
            ...base,
            sig: units ? `${units.text} ${band.freq === 2 ? "twice daily (BID)" : "once daily"} x ${row.durationDays} days` : "Select a matching brand/strength",
            doseText: `${band.mgPerKg} mg/kg/dose \u00d7 ${Math.round(weightKg * 10) / 10} kg = ${mg} mg/dose (${band.label})`,
            isSingleCourse: false
          };
        }
      }
      
      const band = drug.weightBands.find((b) => weightKg <= b.maxKg);
      const units = amountToUnits(band.mg, strength, "mg");
      
      const opt = drug.doseOptions ? drug.doseOptions.find(o => o.id === row.doseOptionId) : null;
      const wbFreq = opt ? opt.freq : (drug.weightBandFreqPerDay || 1);
      const showDuration = drug.weightBandShowDuration || false;
      
      const freqWord = wbFreq === 1 ? (showDuration ? "once daily" : "once (single dose)") : wbFreq === 2 ? "twice daily (BID)" : wbFreq === 3 ? "three times daily (TID)" : `${wbFreq} times daily`;
      const durationText = showDuration ? ` x ${row.durationDays} days` : "";
      
      return {
        ...base,
        sig: units ? `${units.text} ${freqWord}${durationText}` : "Select a matching brand/strength",
        doseText: `${band.mg} mg/dose (${band.label})`,
        totalVolMl: (units && showDuration && units.raw != null && isLiquid) ? roundVolume(units.raw * wbFreq * row.durationDays) : null,
        isSingleCourse: !showDuration
      };
    }

    // ---- Dose options ----
    const opt = drug.doseOptions.find((o) => o.id === row.doseOptionId) || drug.doseOptions[0];
    if (!weightKg && !opt.isDirectMgOption) return { ...base, error: "Enter patient weight." };

    if (opt.isDirectMgOption) {
      const chosenMg = row.mgPerKg != null ? row.mgPerKg : midpoint(opt);
      const units = amountToUnits(chosenMg, strength, "mg");
      const freqWord = opt.freq === 1 ? "once" : opt.freq === 2 ? "twice daily (BID)" : opt.freq === 3 ? "three times daily (TID)" : opt.freq === 4 ? "four times daily (QID)" : `${opt.freq} times daily`;
      const durationText = opt.singleCourse ? "" : ` x ${row.durationDays} days`;
      
      return {
        ...base,
        sig: units ? `${units.text} ${freqWord}${durationText}` : "Select a matching brand/strength",
        doseText: `${chosenMg} mg/dose, fixed (not weight-scaled)`,
        optLabel: opt.label,
        rangeLow: opt.low, rangeHigh: opt.high, isDirectMg: true,
        isSingleCourse: !!opt.singleCourse,
        totalVolMl: (units && units.raw != null && isLiquid && !opt.singleCourse) ? roundVolume(units.raw * opt.freq * row.durationDays) : null,
      };
    }

    // PRN per-dose
    if (drug.isPRN) {
      const perDoseMg = Math.round(row.mgPerKg * weightKg * 10) / 10;
      const capByWeight = opt.maxDayPerKg * weightKg;
      const dailyCap = Math.min(capByWeight, opt.maxDayAbsolute);
      const units = amountToUnits(perDoseMg, strength, "mg");
      return {
        ...base,
        sig: units ? `${units.text}, ${opt.freqLabel}` : "Select a matching brand/strength",
        doseText: `${perDoseMg} mg/dose (max ${Math.round(dailyCap)} mg/day)`,
        formula: `${row.mgPerKg} mg/kg/dose \u00d7 ${Math.round(weightKg * 10) / 10} kg = ${perDoseMg} mg/dose`,
        rangeLow: opt.lowDose, rangeHigh: opt.highDose,
        isSingleCourse: true,
      };
    }

    // Gram-based
    if (drug.isGramDose) {
      let dailyG = row.mgPerKg * weightKg;
      if (opt.maxDay) dailyG = Math.min(dailyG, opt.maxDay);
      dailyG = Math.round(dailyG * 10) / 10;
      const units = amountToUnits(dailyG, strength, "g");
      return {
        ...base,
        sig: units ? `${units.text} once daily x ${row.durationDays} days` : "Select a matching brand/strength",
        doseText: `${dailyG} g/day (max ${opt.maxDay} g/day)`,
        formula: `${row.mgPerKg} g/kg/day \u00d7 ${Math.round(weightKg * 10) / 10} kg = ${dailyG} g/day`,
        rangeLow: opt.low, rangeHigh: opt.high,
        isSingleCourse: false,
      };
    }

    // Standard mg/kg/day or per-dose specific
    let rawDailyMg, dailyMg, perDoseMg;
    if (opt.isPerDose) {
      perDoseMg = Math.round(row.mgPerKg * weightKg * 10) / 10;
      rawDailyMg = perDoseMg * opt.freq;
      dailyMg = opt.maxDay ? Math.min(rawDailyMg, opt.maxDay) : rawDailyMg;
      if (opt.maxDay && rawDailyMg > opt.maxDay) perDoseMg = dailyMg / opt.freq;
    } else {
      rawDailyMg = row.mgPerKg * weightKg;
      dailyMg = opt.maxDay ? Math.min(rawDailyMg, opt.maxDay) : rawDailyMg;
      perDoseMg = dailyMg / opt.freq;
      if (opt.singleDoseMax) perDoseMg = Math.min(perDoseMg, opt.singleDoseMax);
    }
    
    perDoseMg = Math.round(perDoseMg * 10) / 10;
    const wasCapped = opt.maxDay && rawDailyMg > opt.maxDay;
    const units = amountToUnits(perDoseMg, strength, "mg");
    const freqWord = opt.freq === 1 ? "once daily" : opt.freq === 2 ? "twice daily (BID)" : opt.freq === 3 ? "three times daily (TID)" : opt.freq === 4 ? "four times daily (QID)" : `${opt.freq} times daily`;
    const durationText = opt.singleCourse ? "" : ` x ${row.durationDays} days`;
    const maxLabel = opt.maxDay ? ` (max ${opt.maxDay} mg/day)` : "";
    
    return {
      ...base,
      sig: units ? `${units.text} ${freqWord}${durationText}` : "Select a matching brand/strength",
      doseText: `${perDoseMg} mg/dose (${Math.round(dailyMg)} mg/day${maxLabel})`,
      formula: opt.isPerDose 
        ? `${row.mgPerKg} mg/kg/dose \u00d7 ${Math.round(weightKg * 10) / 10} kg = ${perDoseMg} mg/dose`
        : `${row.mgPerKg} mg/kg/day \u00d7 ${Math.round(weightKg * 10) / 10} kg = ${Math.round(rawDailyMg)} mg/day \u00f7 ${opt.freq} = ${perDoseMg} mg/dose`,
      totalVolMl: (units && units.raw != null && isLiquid && !opt.singleCourse) ? roundVolume(units.raw * opt.freq * row.durationDays) : null,
      optLabel: opt.label,
      rangeLow: opt.low, rangeHigh: opt.high,
      capped: wasCapped,
      maxDay: opt.maxDay,
      isSingleCourse: !!opt.singleCourse,
    };
  }

  function handleSavePDF() {
    const hasTopicalOnly = rows.some((r) => DRUGS.find((d) => d.id === r.drugId).topicalOnly);
    const hasRowErrors = rows.some((r) => {
      const res = calc(r);
      return res.error || (!res.drug.topicalOnly && !patientValid);
    });
    
    if (!patientValid && !hasTopicalOnly) { setErrors({ patient: "Enter both age and weight." }); return; }
    if (rows.length === 0) { setErrors({ drugs: "Add at least one drug." }); return; }
    if (hasRowErrors) { setErrors({ patient: "Please resolve dosing or patient parameter errors before generating the prescription." }); return; }
    
    setErrors({});
    downloadRxPDF(rows, calc, patientName, sex, ageLabel, weight, heightCm, ageMonths);
  }

  const availableDrugs = DRUGS.filter((d) => !rows.some((r) => r.drugId === d.id));
  
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 920, margin: "0 auto", color: "#1a1a1a" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div className="no-print" style={{ background: "#fef3e2", border: "1px solid #f0c674", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
        <strong>Prototype -- clinical verification required.</strong> Scoped to drugs actually stocked in this OPD pharmacy. Dosing, administration notes, and precautions are from the uploaded evidence-based reference; brand names and exact compositions are from the uploaded pharmacy formulary. No interaction, allergy, or renal/hepatic checking is performed. Verify every dose before it reaches a patient. Patient name, age, weight, and height all appear in the prescription output below -- this is an intentional design choice for this app.
      </div>
      
      <div className="no-print" style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Patient name</label>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Optional" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: "1 1 120px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Sex</label>
          <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}>
            <option value="">{"Select\u2026"}</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div style={{ flex: "1 1 160px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Date of birth</label>
          <input type="date" value={dob} max={toISODateLocal(new Date())} onChange={(e) => setDob(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: "#777", marginTop: 6 }}>
            {dob ? (
              <button type="button" onClick={() => setDob("")} style={{ padding: 0, border: "none", background: "none", color: "#1d6f5c", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Clear date (enter age manually)</button>
            ) : "Optional \u2014 age is calculated automatically as of today"}
          </div>
        </div>
        <div style={{ flex: "1 1 160px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>{dob ? "Age (auto from DOB)" : "Age"}</label>
          {dob ? (
            <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #cfe3dc", background: "#eef6f3", fontSize: 14, fontWeight: 600, color: "#1d6f5c" }}>
              {dobMonths !== null ? dobInfo.label : "Invalid date of birth"}
            </div>
          ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min="0" value={ageValue} onChange={(e) => setAgeValue(e.target.value)} placeholder="18" style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, minWidth: 0 }} />
            <select value={ageUnit} onChange={(e) => setAgeUnit(e.target.value)} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}>
              <option value="months">months</option>
              <option value="years">years</option>
            </select>
          </div>
          )}
        </div>
        <div style={{ flex: "1 1 130px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Weight (kg)</label>
          <input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="12.5" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: "1 1 130px", background: "#f7f7f5", borderRadius: 8, padding: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Height/Length (cm)</label>
          <input type="number" min="0" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="85" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" }} />
        </div>
      </div>
      
      {errors.patient && <div className="no-print" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{errors.patient}</div>}
      
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Add drug</label>
          <select value={drugToAdd} onChange={(e) => setDrugToAdd(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}>
            <option value="">{"Select a drug\u2026"}</option>
            {CATEGORY_ORDER.map((cat) => (
              <optgroup key={cat} label={cat}>
                {availableDrugs.filter((d) => d.category === cat).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.discouraged ? " \u26a0" : ""}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button onClick={addDrug} disabled={!drugToAdd} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #1d6f5c", background: drugToAdd ? "#1d6f5c" : "#a9c9c0", color: "#fff", fontSize: 14, cursor: drugToAdd ? "pointer" : "not-allowed", fontWeight: 600 }}>
          Add
        </button>
      </div>
      
      {errors.drugs && <div className="no-print" style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{errors.drugs}</div>}
      
      {rows.length > 0 && (
        <div className="no-print" style={{ marginTop: 20 }}>
          {rows.map((row) => {
            const drug = DRUGS.find((d) => d.id === row.drugId);
            const result = calc(row);
            return (
              <div key={row.rowId} style={{ border: drug.discouraged ? "1px solid #e39" : "1px solid #e0e0dd", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{drug.discouraged ? "\u26a0 " : ""}{drug.name}</div>
                  <button onClick={() => removeRow(row.rowId)} style={{ border: "none", background: "none", color: "#888", cursor: "pointer", fontSize: 13 }}>Remove</button>
                </div>
                
                {result.belowAge && (
                  <div style={{ background: "#fdeaea", color: "#b91c1c", fontSize: 13, padding: "8px 10px", borderRadius: 6, marginTop: 8 }}>
                    Patient age is below this reference's minimum ({drug.minAgeMonths} months) for {drug.name}. Verify independently.
                  </div>
                )}
                {result.belowWeight && (
                  <div style={{ background: "#fdeaea", color: "#b91c1c", fontSize: 13, padding: "8px 10px", borderRadius: 6, marginTop: 8 }}>
                    Patient weight is below this reference's minimum ({drug.minWeightKg} kg) for {drug.name}. Verify independently.
                  </div>
                )}
                {result.precaution && (
                  <div style={{ background: "#fdeaea", color: "#8a1a1a", fontSize: 12, padding: "8px 10px", borderRadius: 6, marginTop: 8, fontWeight: 500 }}>
                    {`\u26a0 PRECAUTION: ${result.precaution}`}
                  </div>
                )}
                {result.sourceNote && (
                  <div style={{ background: "#eef6ff", color: "#1a4d7a", fontSize: 12, padding: "8px 10px", borderRadius: 6, marginTop: 8 }}>
                    {result.sourceNote}
                  </div>
                )}
                
                {drug.weightBandTable && drug.doseOptions && (
                  <div style={{ marginTop: 10, background: "#f0f7f4", borderRadius: 6, padding: 8 }}>
                    <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4, fontWeight: 600 }}>Dosing method</label>
                    <div style={{ display: "flex", gap: 16 }}>
                      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" checked={row.dosingMode !== "mgkg"} onChange={() => updateRow(row.rowId, { dosingMode: "weightband" })} />
                        Weight-band (standard)
                      </label>
                      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="radio" checked={row.dosingMode === "mgkg"} onChange={() => updateRow(row.rowId, { dosingMode: "mgkg" })} />
                        mg/kg calculation (alternative)
                      </label>
                    </div>
                  </div>
                )}
                
                {drug.doseOptions && (!drug.weightBandTable || row.dosingMode === "mgkg") && (
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 260px" }}>
                      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Indication / regimen</label>
                      <select
                        value={row.doseOptionId}
                        onChange={(e) => changeDoseOption(row.rowId, e.target.value, drug)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                      >
                        {drug.doseOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                
                {drug.isIU && result.iuOptions && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Regimen</label>
                    <select
                      value={row.iuOptionIdx || 0}
                      onChange={(e) => updateRow(row.rowId, { iuOptionIdx: parseInt(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                    >
                      {result.iuOptions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                
                {drug.doseOptions && !drug.isIU && result.rangeLow != null && result.rangeHigh != null && result.rangeLow !== result.rangeHigh && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, color: "#666", display: "flex", justifyContent: "space-between" }}>
                      <span>{result.isDirectMg ? `Dose within range: ${result.rangeLow}\u2013${result.rangeHigh} mg (fixed, not weight-scaled)` : `Dose within range: ${result.rangeLow}\u2013${result.rangeHigh} ${drug.isGramDose ? "g" : "mg"}/kg${drug.doseOptions.find(o=>o.id===row.doseOptionId)?.isPerDose || drug.isPRN ? "/dose" : "/day"}`}</span>
                      <span style={{ fontWeight: 600, color: "#0f4d3f" }}>{row.mgPerKg}</span>
                    </label>
                    <input
                      type="range"
                      min={result.rangeLow}
                      max={result.rangeHigh}
                      step={sliderStep(result.rangeLow, result.rangeHigh, drug.isGramDose)}
                      value={row.mgPerKg}
                      onChange={(e) => updateRow(row.rowId, { mgPerKg: parseFloat(e.target.value) })}
                      style={{ width: "100%" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999" }}>
                      <span>{result.rangeLow} (low end)</span>
                      <span>{result.rangeHigh} (high end)</span>
                    </div>
                  </div>
                )}
                
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Brand</label>
                    <select
                      value={row.brandIdx}
                      onChange={(e) => updateRow(row.rowId, { brandIdx: parseInt(e.target.value), strengthIdx: 0 })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                    >
                      {drug.brands.map((b, i) => <option key={i} value={i}>{b.name} ({b.manufacturer})</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Formulation / strength</label>
                    <select
                      value={row.strengthIdx}
                      onChange={(e) => updateRow(row.rowId, { strengthIdx: parseInt(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                    >
                      {drug.brands[row.brandIdx].strengths.map((s, i) => <option key={i} value={i}>{strengthLabel(s)}</option>)}
                    </select>
                  </div>
                  
                  {!drug.ageBased && !drug.topicalOnly && drug.id !== "oseltamivir" && !drug.weightBandTable && (
                    <div style={{ flex: "0 1 100px" }}>
                      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Days</label>
                      <input
                        type="number" min="1"
                        value={row.durationDays}
                        onChange={(e) => updateRow(row.rowId, { durationDays: parseInt(e.target.value) || 1 })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                  )}
                  {drug.weightBandTable && drug.weightBandShowDuration && (
                    <div style={{ flex: "0 1 100px" }}>
                      <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Days</label>
                      <input
                        type="number" min="1"
                        value={row.durationDays}
                        onChange={(e) => updateRow(row.rowId, { durationDays: parseInt(e.target.value) || 1 })}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </div>
                  )}
                </div>
                
                {!patientValid && !drug.topicalOnly ? (
                  <div style={{ fontSize: 13, color: "#888", marginTop: 10 }}>Enter age and weight to calculate.</div>
                ) : result.error ? (
                  <div style={{ fontSize: 13, color: "#b91c1c", marginTop: 10 }}>{result.error}</div>
                ) : (
                  <div style={{ marginTop: 10, background: drug.discouraged ? "#fdeaea" : "#f7f7f5", borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: drug.discouraged ? "#8a1a1a" : "#0f4d3f" }}>{result.sig}</div>
                    {result.doseText && <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{result.doseText}</div>}
                    {result.formula && <div style={{ fontSize: 11, color: "#999", marginTop: 4, fontFamily: "monospace" }}>{result.formula}</div>}
                    {result.totalVolMl && <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{`Dispense: \u2248${result.totalVolMl} mL total for the course`}</div>}
                    {result.capped && (
                      <div style={{ background: "#fff4e5", color: "#8a5300", fontSize: 12, padding: "6px 8px", borderRadius: 4, marginTop: 6 }}>
                        {`\u26a0 Weight-based calculation exceeded the ${result.maxDay} mg/day ceiling for this regimen \u2014 dose has been capped at the maximum.`}
                      </div>
                    )}
                  </div>
                )}
                
                {drug.adminNote && (
                  <div style={{ marginTop: 8, borderLeft: "3px solid #1d6f5c", paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1d6f5c", textTransform: "uppercase", letterSpacing: 0.3 }}>Administration note</div>
                    <div style={{ fontSize: 12, color: "#333", marginTop: 2 }}>{drug.adminNote}</div>
                  </div>
                )}
                {drug.notes && <div style={{ fontSize: 11, color: "#999", marginTop: 8 }}>{drug.notes}</div>}
              </div>
            );
          })}
        </div>
      )}
      
      {rows.length > 0 && (rows.some((r) => DRUGS.find((d) => d.id === r.drugId).topicalOnly) || patientValid) && (
        <div style={{ marginTop: 24, border: "1px solid #333", borderRadius: 4, padding: "24px 28px", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #1a1a1a", paddingBottom: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>Prescription</div>
            <div style={{ fontSize: 13, color: "#333" }}>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>
              {patientName && <div><strong>Name:</strong> {patientName}</div>}
              {sex && <div><strong>Sex:</strong> {sex === "male" ? "Male" : "Female"}</div>}
              {ageLabel && <div><strong>Age:</strong> {ageLabel}</div>}
            </div>
            <div style={{ fontSize: 13, color: "#333", lineHeight: 1.7, textAlign: "right", minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Anthropometry</div>
              {weight && <div><strong>Weight:</strong> {weight} kg</div>}
              {heightCm && <div><strong>{ageMonths !== null && ageMonths < 24 ? "Length" : "Height"}:</strong> {heightCm} cm</div>}
            </div>
          </div>
          
          {rows.map((row, idx) => {
            const result = calc(row);
            if (result.error || result.belowAge || result.belowWeight) return null;
            const route = getRoute(result.drug);
            const clockTimes = sigToClockTimes(result.sig);
            
            return (
              <div key={row.rowId} style={{ marginBottom: 18, paddingBottom: 14, borderBottom: idx < rows.length - 1 ? "1px solid #eee" : "none" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {`${idx + 1}. ${result.drug.discouraged ? "\u26a0 " : ""}${result.brand.name} \u2014 ${strengthLabel(result.strength)}`}
                </div>
                {result.doseText && (
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3, fontFamily: "monospace" }}>
                    {`Dose derivation: ${result.formula || result.doseText}`}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#333", marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                  <span><strong>Sig:</strong> {result.sig}</span>
                </div>
                <div style={{ fontSize: 12, color: "#333", marginTop: 3, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                  <span><strong>Frequency (clock times):</strong> {clockTimes}</span>
                  <span><strong>Route:</strong> {route}</span>
                  {!result.drug.topicalOnly && !result.isSingleCourse && <span><strong>Duration:</strong> {row.durationDays} days</span>}
                  {result.totalVolMl && <span><strong>Dispense:</strong> {`\u2248${result.totalVolMl} mL`}</span>}
                </div>
                
                {result.drug.adminNote && (
                  <div style={{ fontSize: 12, color: "#333", marginTop: 4 }}>
                    <strong>Administration &amp; counseling:</strong> {result.drug.adminNote}
                  </div>
                )}
                {result.precaution && (
                  <div style={{ fontSize: 12, color: "#8a1a1a", marginTop: 4, fontWeight: 500 }}>
                    {`\u26a0 ${result.precaution}`}
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={() => copyRxText(rows, calc, patientName, sex, ageLabel, weight, heightCm, ageMonths)} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #1d6f5c", background: "#1d6f5c", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
              Copy to clipboard
            </button>
            <button onClick={handleSavePDF} style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #1d6f5c", background: "#fff", color: "#1d6f5c", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
              Save as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
