const assert=require('node:assert/strict');const{test}=require('node:test');const{join}=require('node:path');
const m=require(join(__dirname,'..','.intake-test-dist','smartphoneIntake.js'));
const {validateSmartphoneIntake,resolveCatalogVariant,deriveMatchFacts,evaluateCandidate}=m;
const submitted='2026-08-24';
function valid(o={}){return{phoneModel:'Apple iPhone 13',storageGb:128,condition:'GOOD',defects:[],batteryHealthPercent:86,activationLockReady:true,ownershipConfirmed:true,minimumPriceCents:30000,region:'DE-KARLSRUHE',availableFromDate:'2026-08-24',availableUntilDate:'2026-08-31',profileDisclosureConsent:true,networkLockStatus:'UNLOCKED',...o}}
function V(o={}){const r=validateSmartphoneIntake(valid(o),submitted);assert.equal(r.ok,true);return r.value}
const catalog=[{variantId:'v13-128',canonicalModel:'Apple iPhone 13',storageGb:128,market:'DE'},{variantId:'v13-256',canonicalModel:'Apple iPhone 13',storageGb:256,market:'DE'}];
function R(o={},c=catalog){const r=resolveCatalogVariant(V(o),c);assert.equal(r.ok,true);return r.value}
function codes(r){assert.equal(r.ok,false);return r.issues.map(x=>x.code)}
const buyer={variantId:'v13-128',maxPriceCents:32000,startsOn:'2026-08-25',expiresOn:'2026-09-02',minBatteryPercent:80,requireIntactDisplay:true,requireBiometrics:true};

test('G1-POS-UNIQUE derives exact catalog identity',()=>{const r=resolveCatalogVariant(V({phoneModel:'  apple   iphone 13  '}),catalog);assert.deepEqual([r.ok,r.value.variantId,r.value.canonicalModel,r.value.storageGb],[true,'v13-128','Apple iPhone 13',128])});
test('G1-NEG-STORAGE fails closed',()=>{const r=resolveCatalogVariant(V({storageGb:512}),catalog);assert.deepEqual(r,{ok:false,reason:'UNKNOWN_CATALOG_VARIANT'})});
test('G1-NEG-AMBIGUOUS never picks first row',()=>{const r=resolveCatalogVariant(V(),[catalog[0],{...catalog[0],variantId:'dup'}]);assert.deepEqual(r,{ok:false,reason:'AMBIGUOUS_CATALOG_VARIANT'})});
test('G1-NEG-ID-INJECTION rejects owner variantId',()=>{assert.ok(codes(validateSmartphoneIntake(valid({variantId:'v13-128'}),submitted)).includes('SENSITIVE_OR_AUTHORITY_FIELD_FORBIDDEN'))});

test('G2-POS-OVERLAP is matchable but never client-eligible',()=>{const d=evaluateCandidate(R(),buyer,'2026-08-25');assert.equal(d.matchable,true);assert.equal(d.eligible,false);assert.equal(d.eligibility,'REQUIRES_SERVER_DECISION');assert.deepEqual(d.reasons,[])});
test('G2-NEG-REVERSED rejects reversed owner window',()=>{assert.ok(codes(validateSmartphoneIntake(valid({availableFromDate:'2026-08-30',availableUntilDate:'2026-08-29'}),submitted)).includes('INVALID_AVAILABILITY_RANGE'))});
test('G2-NEG-TOO-LONG caps at 30 days',()=>{assert.ok(codes(validateSmartphoneIntake(valid({availableUntilDate:'2026-09-24'}),submitted)).includes('AVAILABILITY_WINDOW_EXCEEDS_30_DAYS'))});
test('G2-NEG-NO-OVERLAP stays valid but unmatchable',()=>{const x=R({availableFromDate:'2026-09-03',availableUntilDate:'2026-09-10'});assert.deepEqual(evaluateCandidate(x,buyer,'2026-08-25').reasons,['NO_AVAILABILITY_OVERLAP'])});
test('G2-NEG-NO-CONSENT stays private and unmatchable',()=>{const x=R({profileDisclosureConsent:false});assert.deepEqual(evaluateCandidate(x,buyer,'2026-08-25').reasons,['PROFILE_DISCLOSURE_NOT_GRANTED'])});
test('G2-NEG-EXPIRED-BUYER rejects intent expired before as-of',()=>{const expired={...buyer,startsOn:'2026-08-20',expiresOn:'2026-08-24'};const d=evaluateCandidate(R(),expired,'2026-08-25');assert.ok(d.reasons.includes('BUYER_INTENT_EXPIRED'));assert.equal(d.matchable,false)});
test('G2-NEG-BUYER-REVERSED rejects reversed buyer interval',()=>{const reversed={...buyer,startsOn:'2026-09-02',expiresOn:'2026-08-25'};const d=evaluateCandidate(R(),reversed,'2026-08-25');assert.ok(d.reasons.includes('BUYER_INTENT_INVALID_RANGE'));assert.equal(d.matchable,false)});
test('G2-NEG-BUYER-DATE rejects malformed buyer dates',()=>{const malformed={...buyer,startsOn:'2026-02-30'};const d=evaluateCandidate(R(),malformed,'2026-08-25');assert.ok(d.reasons.includes('BUYER_INTENT_INVALID_RANGE'));assert.equal(d.matchable,false)});

test('G3-POS-DERIVATION derives deterministic match facts',()=>{const f=deriveMatchFacts(R({defects:['DISPLAY','CAMERA','BUTTONS']}));assert.deepEqual({displayState:f.displayState,housingState:f.housingState,camerasWorking:f.camerasWorking,biometricsWorking:f.biometricsWorking,batteryHealthPercent:f.batteryHealthPercent,otherDefect:f.otherDefect},{displayState:'DAMAGED',housingState:'LIGHT_WEAR',camerasWorking:false,biometricsWorking:true,batteryHealthPercent:86,otherDefect:true})});
test('G3-POS-CANDIDATE never promotes client matchability to market eligibility',()=>{const d=evaluateCandidate(R(),buyer,'2026-08-25');assert.equal(d.matchable,true);assert.equal(d.eligible,false);assert.equal(d.eligibility,'REQUIRES_SERVER_DECISION')});
test('G3-NEG-BATTERY-UNKNOWN fails closed',()=>{const x=R({batteryHealthPercent:undefined});const d=evaluateCandidate(x,buyer,'2026-08-25');assert.ok(d.reasons.includes('BATTERY_UNKNOWN'));assert.equal(d.matchable,false)});
test('G3-NEG-NETWORK distinguishes locked and unknown',()=>{assert.ok(evaluateCandidate(R({networkLockStatus:'LOCKED'}),buyer,'2026-08-25').reasons.includes('NETWORK_LOCKED'));assert.ok(evaluateCandidate(R({networkLockStatus:'UNKNOWN'}),buyer,'2026-08-25').reasons.includes('NETWORK_LOCK_UNKNOWN'))});
test('G3-NEG-PRICE rejects floor above buyer maximum',()=>{assert.deepEqual(evaluateCandidate(R({minimumPriceCents:32001}),buyer,'2026-08-25').reasons,['PRICE_FLOOR_ABOVE_MAXIMUM'])});
test('G3-NEG-VARIANT requires exact resolved variant equality',()=>{const d=evaluateCandidate(R(),{...buyer,variantId:'v13-256'},'2026-08-25');assert.ok(d.reasons.includes('VARIANT_MISMATCH'))});

test('defect note is required and normalized only for OTHER',()=>{assert.ok(codes(validateSmartphoneIntake(valid({defects:['OTHER']}),submitted)).includes('DEFECT_NOTE_REQUIRED'));assert.ok(codes(validateSmartphoneIntake(valid({defectNote:'scratch'}),submitted)).includes('UNEXPECTED_DEFECT_NOTE'));const r=validateSmartphoneIntake(valid({defects:['OTHER'],defectNote:'  Charging   port intermittent.  '}),submitted);assert.equal(r.ok,true);assert.equal(r.value.defectNote,'Charging port intermittent.')});
test('defect note enforces 3-200 normalized characters',()=>{assert.ok(codes(validateSmartphoneIntake(valid({defects:['OTHER'],defectNote:'x'}),submitted)).includes('DEFECT_NOTE_REQUIRED'));assert.ok(codes(validateSmartphoneIntake(valid({defects:['OTHER'],defectNote:'x'.repeat(201)}),submitted)).includes('DEFECT_NOTE_REQUIRED'))});
test('privacy and authority guard rejects sensitive/status fields',()=>{for(const field of ['imei','serialNumber','password','fullAddress','latitude','marketState','possessionStatus','verified','provenance','eligibility'])assert.ok(codes(validateSmartphoneIntake(valid({[field]:'x'}),submitted)).includes('SENSITIVE_OR_AUTHORITY_FIELD_FORBIDDEN'))});
test('network defect never implies network lock',()=>{assert.equal(deriveMatchFacts(R({defects:['NETWORK'],networkLockStatus:'UNKNOWN'})).networkLockStatus,'UNKNOWN')});
test('missing battery remains null, never 100',()=>{assert.equal(deriveMatchFacts(R({batteryHealthPercent:undefined})).batteryHealthPercent,null)});
