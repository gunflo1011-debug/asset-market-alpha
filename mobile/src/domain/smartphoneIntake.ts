export const STORAGE_OPTIONS_GB = [16,32,64,128,256,512,1024,2048] as const;
export const PHONE_CONDITIONS = ['LIKE_NEW','GOOD','FAIR','DAMAGED'] as const;
export const PHONE_DEFECTS = ['DISPLAY','HOUSING','CAMERA','BIOMETRICS','BATTERY','BUTTONS','CHARGING','AUDIO','NETWORK','OTHER'] as const;
export const COARSE_REGIONS = ['DE-KARLSRUHE','DE-BRUCHSAL','DE-RHEIN-NECKAR','DE-OTHER-BW'] as const;
export const NETWORK_LOCK_STATES = ['UNKNOWN','UNLOCKED','LOCKED'] as const;

export type NetworkLockStatus=(typeof NETWORK_LOCK_STATES)[number];
export type SmartphoneIntake=Readonly<{phoneModel:string;storageGb:number;condition:(typeof PHONE_CONDITIONS)[number];defects:ReadonlyArray<(typeof PHONE_DEFECTS)[number]>;defectNote?:string;batteryHealthPercent?:number;activationLockReady:true;ownershipConfirmed:true;minimumPriceCents:number;region:(typeof COARSE_REGIONS)[number];availableFromDate:string;availableUntilDate:string;profileDisclosureConsent:boolean;networkLockStatus:NetworkLockStatus}>;
export type Validation={ok:true;value:SmartphoneIntake}|{ok:false;issues:ReadonlyArray<{field:string;code:string}>};
export type CatalogRow=Readonly<{variantId:string;canonicalModel:string;storageGb:number;market:string}>;
export type ResolvedVariant=Readonly<SmartphoneIntake & {variantId:string;canonicalModel:string}>;
export type ResolveResult={ok:true;value:ResolvedVariant}|{ok:false;reason:'UNKNOWN_CATALOG_VARIANT'|'AMBIGUOUS_CATALOG_VARIANT'};
export type BuyerIntent=Readonly<{variantId:string;maxPriceCents:number;startsOn:string;expiresOn:string;minBatteryPercent?:number;requireIntactDisplay?:boolean;requireBiometrics?:boolean}>;
export type OperatorGate=Readonly<{possessionStatus:'VERIFIED'|'UNVERIFIED';marketState:'MARKET_ELIGIBLE'|'PRIVATE'}>;

const ALLOWED=new Set(['phoneModel','storageGb','condition','defects','defectNote','batteryHealthPercent','activationLockReady','ownershipConfirmed','minimumPriceCents','region','availableFromDate','availableUntilDate','profileDisclosureConsent','networkLockStatus']);
const UNSAFE=/(?:imei|serial|credential|password|passcode|full.?address|street|house.?number|latitude|longitude|gps|variant.?id|possession.?status|market.?state|verified|market.?eligible)/i;
const oneOf=(v:unknown,a:readonly unknown[])=>a.includes(v);
const rec=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const norm=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const date=(s:unknown)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s;
const plusDays=(s:string,d:number)=>{const x=new Date(`${s}T00:00:00Z`);x.setUTCDate(x.getUTCDate()+d);return x.toISOString().slice(0,10)};

export function validateSmartphoneIntake(input:unknown,submittedOn:string):Validation{
 if(!rec(input)) return {ok:false,issues:[{field:'$',code:'OBJECT_REQUIRED'}]};
 const issues:{field:string;code:string}[]=[];
 for(const k of Object.keys(input)){if(UNSAFE.test(k))issues.push({field:k,code:'SENSITIVE_OR_AUTHORITY_FIELD_FORBIDDEN'});else if(!ALLOWED.has(k))issues.push({field:k,code:'UNKNOWN_FIELD'});}
 const model=typeof input.phoneModel==='string'?input.phoneModel.trim().replace(/\s+/g,' '):'';
 if(model.length<2||model.length>80||!/[A-Za-z]/.test(model))issues.push({field:'phoneModel',code:'INVALID_MODEL'});
 if(!oneOf(input.storageGb,STORAGE_OPTIONS_GB))issues.push({field:'storageGb',code:'INVALID_STORAGE'});
 if(!oneOf(input.condition,PHONE_CONDITIONS))issues.push({field:'condition',code:'INVALID_CONDITION'});
 const defects=Array.isArray(input.defects)?input.defects:null;
 if(!defects||!defects.every(v=>oneOf(v,PHONE_DEFECTS)))issues.push({field:'defects',code:'INVALID_DEFECTS'}); else if(new Set(defects).size!==defects.length)issues.push({field:'defects',code:'DUPLICATE_DEFECT'});
 if(input.condition==='DAMAGED'&&defects?.length===0)issues.push({field:'defects',code:'DEFECT_REQUIRED'});
 if(input.batteryHealthPercent!==undefined&&(!Number.isInteger(input.batteryHealthPercent)||(input.batteryHealthPercent as number)<1||(input.batteryHealthPercent as number)>100))issues.push({field:'batteryHealthPercent',code:'INVALID_BATTERY_HEALTH'});
 if(input.activationLockReady!==true)issues.push({field:'activationLockReady',code:'ACTIVATION_LOCK_NOT_READY'});
 if(input.ownershipConfirmed!==true)issues.push({field:'ownershipConfirmed',code:'OWNERSHIP_NOT_CONFIRMED'});
 if(!Number.isInteger(input.minimumPriceCents)||(input.minimumPriceCents as number)<100||(input.minimumPriceCents as number)>500000)issues.push({field:'minimumPriceCents',code:'INVALID_MINIMUM_PRICE'});
 if(!oneOf(input.region,COARSE_REGIONS))issues.push({field:'region',code:'INVALID_REGION'});
 if(!date(input.availableFromDate)||!date(input.availableUntilDate)||!date(submittedOn))issues.push({field:'availability',code:'INVALID_AVAILABILITY_DATE'}); else {const f=input.availableFromDate as string,u=input.availableUntilDate as string;if(f<submittedOn||u<f)issues.push({field:'availability',code:'INVALID_AVAILABILITY_RANGE'});if(u>plusDays(submittedOn,30))issues.push({field:'availableUntilDate',code:'AVAILABILITY_WINDOW_EXCEEDS_30_DAYS'});}
 if(typeof input.profileDisclosureConsent!=='boolean')issues.push({field:'profileDisclosureConsent',code:'INVALID_DISCLOSURE_CONSENT'});
 if(!oneOf(input.networkLockStatus,NETWORK_LOCK_STATES))issues.push({field:'networkLockStatus',code:'INVALID_NETWORK_LOCK_STATUS'});
 if(issues.length)return {ok:false,issues};
 return {ok:true,value:Object.freeze({phoneModel:model,storageGb:input.storageGb as number,condition:input.condition as SmartphoneIntake['condition'],defects:Object.freeze([...(defects as SmartphoneIntake['defects'])]),...(typeof input.defectNote==='string'?{defectNote:input.defectNote.trim()}:{}),...(input.batteryHealthPercent===undefined?{}:{batteryHealthPercent:input.batteryHealthPercent as number}),activationLockReady:true,ownershipConfirmed:true,minimumPriceCents:input.minimumPriceCents as number,region:input.region as SmartphoneIntake['region'],availableFromDate:input.availableFromDate as string,availableUntilDate:input.availableUntilDate as string,profileDisclosureConsent:input.profileDisclosureConsent as boolean,networkLockStatus:input.networkLockStatus as NetworkLockStatus})};
}

export function resolveCatalogVariant(v:SmartphoneIntake,catalog:ReadonlyArray<CatalogRow>):ResolveResult{
 const m=catalog.filter(r=>r.market==='DE'&&r.storageGb===v.storageGb&&norm(r.canonicalModel)===norm(v.phoneModel));
 if(m.length===0)return {ok:false,reason:'UNKNOWN_CATALOG_VARIANT'};if(m.length>1)return {ok:false,reason:'AMBIGUOUS_CATALOG_VARIANT'};const r=m[0]!;return {ok:true,value:Object.freeze({...v,variantId:r.variantId,canonicalModel:r.canonicalModel,storageGb:r.storageGb})};
}

export function deriveMatchFacts(v:ResolvedVariant){const d=new Set(v.defects);return Object.freeze({variantId:v.variantId,displayState:d.has('DISPLAY')?'DAMAGED':'INTACT',housingState:d.has('HOUSING')?'DAMAGED':v.condition==='LIKE_NEW'?'CLEAN':v.condition==='GOOD'?'LIGHT_WEAR':'HEAVY_WEAR',camerasWorking:!d.has('CAMERA'),biometricsWorking:!d.has('BIOMETRICS'),batteryHealthPercent:v.batteryHealthPercent??null,otherDefect:['BATTERY','BUTTONS','CHARGING','AUDIO','NETWORK','OTHER'].some(x=>d.has(x as any)),networkLockStatus:v.networkLockStatus});}

export function evaluateCandidate(v:ResolvedVariant,b:BuyerIntent,g:OperatorGate,asOfDate:string){const r:string[]=[];const f=deriveMatchFacts(v);if(v.variantId!==b.variantId)r.push('VARIANT_MISMATCH');if(v.minimumPriceCents>b.maxPriceCents)r.push('PRICE_FLOOR_ABOVE_MAXIMUM');if(!v.profileDisclosureConsent)r.push('PROFILE_DISCLOSURE_NOT_GRANTED');const bs=b.startsOn>asOfDate?b.startsOn:asOfDate;if(!(v.availableFromDate<=b.expiresOn&&bs<=v.availableUntilDate))r.push('NO_AVAILABILITY_OVERLAP');if(b.minBatteryPercent!==undefined){if(f.batteryHealthPercent===null)r.push('BATTERY_UNKNOWN');else if(f.batteryHealthPercent<b.minBatteryPercent)r.push('BATTERY_BELOW_MINIMUM');}if(b.requireIntactDisplay&&f.displayState!=='INTACT')r.push('DISPLAY_NOT_INTACT');if(b.requireBiometrics&&!f.biometricsWorking)r.push('BIOMETRICS_NOT_WORKING');if(v.networkLockStatus==='LOCKED')r.push('NETWORK_LOCKED');if(v.networkLockStatus==='UNKNOWN')r.push('NETWORK_LOCK_UNKNOWN');if(g.possessionStatus!=='VERIFIED'||g.marketState!=='MARKET_ELIGIBLE')r.push('OPERATOR_GATE_NOT_MET');return Object.freeze({eligible:r.length===0,reasons:Object.freeze(r)});}
