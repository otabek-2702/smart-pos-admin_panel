# August 2026 supplier-item review

Status: **user-confirmed catalog imported to production on 2026-09-05**

## Scope and evidence

- Telegram receipt period: 2026-08-01 through 2026-08-31, inclusive.
- Local files reviewed: 249 JPG images.
- Unique image hashes: 248. One later image is an exact duplicate.
- August 1-19 validation: all 176 files decode, have unique message/media IDs, and match the saved manifest hashes and sizes.
- Balances and purchase amounts are intentionally excluded from this item-master review.
- `Exact` means the supplier or brand is printed in the evidence. `Probable` means the operational supplier name is inferred from the user's 22-name list and must be confirmed.

## Production import result

- Reused the 22 approved suppliers already present in production; the old `hj` supplier remains inactive.
- Created two base units: `Dona` (`dona`, count) and `Kilogram` (`kg`, weight).
- Created 102 unique stock items with deterministic `AUG26-*` SKUs and zero opening stock.
- Created 103 supplier-item assignments. `Un` is one shared stock item linked to both Un do'kon and Marhamat chicken.
- Used `RAW` for food/drink inputs and `PACKAGING` for Idishchi and Shaxrixon kraft items.
- Supplier prices were not provided. The required link price is temporarily `0`, with an explicit unknown-price note on every imported link; it must be replaced on the first real purchase.
- No supplier payment, balance, receipt total, purchase order, receiving, stock adjustment, opening quantity, or treasury record was created or changed.
- A second full reconciliation completed with zero creates, confirming the import is restart-safe against the resulting production state.
- `Fri` and `Kotlet` under Fri Azizbek aka remain deferred because their units were not decided.

## User-confirmed catalog (authoritative for the next import)

Confirmed with the user on 2026-09-05. Money transfers, supplier payments, balances, and receipt totals must not be imported from this review.

### 1. Lavash

- Lavash

### 2. Bulochka Shaxrixon

- Non
- Hot-dog
- Big
- Karalevskiy
- Gril

### 3. Bulochka Baxtiyor aka

- Chips

### 4. Milliy cola

- Limoo Milliy 0.5 L
- Limoo Milliy 1 L
- Limoo Milliy 1.5 L
- Milliy Cola 0.5 L
- Milliy Cola 1 L
- Milliy Cola 1.5 L
- Sayhun Green Still 0.5 L
- Sayhun Green Still 1 L

`AQUA` is explicitly excluded.

### 5. Moxito banochniy suvlar

- Moxito Classic
- Moxito Ferry
- Laymon Green 0.45 L
- Laymon Granat 0.45 L
- Laymon Myata Green Tea 0.45 L
- Laymon Myata Black Tea 0.45 L

### 6. Dena sok

- Dena Apricot 1 L
- Dena Peach 1 L
- Dena Green Apple 1 L
- Dena Red Apple 1 L
- Dena Multifruit 1 L
- Dena Quince 1 L
- Dena Berry Mix 1 L
- Dena Pomegranate 1 L
- Dena Pomegranate 0.33 L
- Dena Multifruit 0.33 L
- Dena Green Apple 0.33 L
- Moxito promo product

### 7. Andijon go'sht do'koni

Create the supplier with **no items**. Ask the manager later.

### 8. Majmua do'kon

- Yog'
- Marli
- Chig'atoy
- Saqich
- Shakar
- Tomat
- Kofe
- Tuxum
- Lactel sut 2%
- Lactel sut 3%

There is no separate generic `Sut` item; the milk rows are Lactel products.

### 9. Bozor Pomidor

- Pomidor
- Bodring
- Bolgar qalampiri
- Piyoz
- Qizil piyoz
- Aysberg
- Ko'kat / ukrop
- Myata
- Chesnok
- Limon

### 10. Anor suv (party)

- MANI Anor 0.3 L

### 11. Be Fresh

- Micco Pear 0.5 L
- Micco Grape 0.5 L
- Micco Melon 0.5 L
- Micco Pear 1 L
- Micco Grape 1 L
- Micco Melon 1 L

### 12. Un do'kon

- Un

### 13. Shirinlik

Create the supplier with **no items** for now.

### 14. Meva Asl market

Create the supplier with **no items** for now.

### 15. Smes Muzqaymoq

- Smes

The Surprise mixes, syrups, and boba products are explicitly excluded.

### 16. Marhamat chicken

- Strepsi
- Naggetsi
- Qanot
- File
- Burger go'shti
- Portsiya
- Un
- Pizza go'shti

### 17. Go'sht do'kon

Create the supplier with **no items** for now.

### 18. Tanxo

- Akbel sir
- Tanho Euro Vkus ketchup 25 g
- Tanho Syrnyy sauce 25 g
- Tanho Provansal-Burger mayonnaise 40%, 5 kg
- Picanto Syrnyy sauce 30%, 800 g
- Tanho Sladkiy ketchup 950 g
- Tanho Chili 330 g
- IBRAT tomat 1 L

### 19. Idishchi

- Perchatka qora L Belarus
- AK-001 Ice Cream 125
- ECO-016 Ice Cream 125
- ECO-027 large paper bowl
- ECO-034 medium bowl
- DK-065 dessert 150
- Small colored spoon / FNP-031
- FNP-053 black frame 1 L
- FNP-063 sauce 50
- FNP-073 black straw
- FNP-096 black spoon
- OSQ-048 small fries
- PT-014 craft cup 330
- QOSHIQ 10KG dessert PP
- RUS-008 Lochin
- TES-001 sauce 50
- XT-009 shaker
- ZM matte 500 dome cup
- ZM-051 5X container

### 20. Shaxrixon kraft

- Lavash
- Lavash qizil
- Non burger 22
- List 28x40
- Paket

`Paket 27` is explicitly excluded, and the former `Paket 21` name is normalized to `Paket`.

### 21. Donar go'sht

- Donar go'sht — unit: kg

### 22. Fri Azizbek aka

- Fri — unit not decided
- Kotlet — unit not decided

## Evidence notes before user confirmation (historical)

The following section records what could be read or inferred from the August evidence before the user supplied the authoritative assignments above. It must not override the confirmed catalog.

### 1. Lavash — unresolved

- Group text says `200 000 lavashga`, but no August receipt photo directly names this supplier or proves its item list.
- Do not copy the Shaxrixon Kraft invoice's `Lavash` packaging rows to this separate supplier.

### 2. Bulochka Shaxrixon — unresolved branch

The recurring bakery slips clearly contain these items, but the slips do not distinguish this supplier from Bulochka Baxtiyor aka:

- Non
- Hot-dog
- Big
- Karol
- Gril

### 3. Bulochka Baxtiyor aka — partly understood

- Chips — explicitly stated in the group text as `10 ta Chips Baxtiyor Aka`.
- The recurring bakery list above may belong partly or entirely to this supplier; the images do not prove the split.

### 4. Milliy cola — exact

- Limoo Milliy 0.5 L
- Limoo Milliy 1 L
- Limoo Milliy 1.5 L
- Milliy Cola 0.5 L
- Milliy Cola 1 L
- Milliy Cola 1.5 L
- Sayhun Green 0.5 L, still / no gas
- Sayhun Green 1 L, still / no gas
- AQUA — seen only as a promotion; exact size/variant must be checked before creation

### 5. Moxito banochniy suvlar — exact

- Moxito Klassik, FERRY can
- Laymon 0.45 L Green, can
- Laymon 0.45 L Granat, can
- Laymon Myata Green Tea 0.45 L, can
- Laymon Myata Black Tea 0.45 L, can

### 6. Dena sok — exact product family

Printed legal supplier: Millano Global Servis / Firma Do'koni Dena.

- Abrikos Dena 1 L
- Persik Dena 1 L
- Green Apple Dena 1 L
- Red Apple Dena 1 L
- Multifruct Dena 1 L
- Ayva Dena 1 L
- Berry Mix Dena 1 L
- Granat Dena 1 L
- Granat Dena 0.33 L
- Multifruct Dena 0.33 L
- Green Apple Dena 0.33 L
- Moxito — free-promo line; confirm whether it should be created under Dena

### 7. Andijon go'sht do'koni — unresolved

- No image safely separates this supplier from Go'sht do'kon or Donar go'sht.
- Anonymous wrapped red meat, XOJI OTA products, and `Marhamat go'shti` require human assignment.

### 8. Majmua do'kon — unresolved

- Repeated general-grocery notes are likely candidates, but no supplier identity is printed.
- Candidate products are listed under **Unassigned product families** below.

### 9. Bozor Pomidor — probable but pooled with Meva Asl market

The daily produce slips repeatedly contain:

- Pomidor
- Bodring
- Bolgar
- Piyoz / qizil piyoz
- Ayzberg
- Ko'kat
- Myata
- Chesnok
- Limon

The product family fits the supplier name, but the slips do not print `Bozor Pomidor` and do not separate it from Meva Asl market.

### 10. Anor suv (party) — probable operational mapping

- MANI 0.3 ANOR

The printed legal supplier is HONEST TRADE MRH. Confirm that the operational supplier should be `Anor suv (party)`.

### 11. Be Fresh — no safe item evidence

- No August image safely maps an item to Be Fresh.
- The Micco drink family is a possible candidate but must not be assigned without confirmation: Pear, Grape, and Melon in 0.5 L and 1 L.

### 12. Un do'kon — no safe item evidence

- No separate flour-shop receipt is identified.
- `Un` appears inside confirmed Marhamat Chicken dispatches, so those rows belong to Marhamat Chicken and are not evidence for Un do'kon.

### 13. Shirinlik — unresolved

- Alif filled candies are a possible semantic match only.
- `SHERIN` sausage/salami is unrelated to `Shirinlik` on current evidence and must not be mapped here.

### 14. Meva Asl market — unresolved

- Anonymous market/wholesale notes repeatedly include Akbel cheese, other cheese, salami, ketchup, mayonnaise, and sometimes Nutella or mustard.
- The recurring produce pool may also belong partly or entirely to this supplier rather than Bozor Pomidor.
- These may belong to Meva Asl market, Majmua do'kon, Bozor Pomidor, or another supplier.

### 15. Smes Muzqaymoq — strong probable mapping

Printed document name: ANJAN. Products:

- SURPRISE 3.5 kg Malina Premium
- Coffee mix
- Ananas mix
- Coconut mix
- Mango mix
- SURPRISE 6 kg Sgushonka

Other anonymous syrup/boba supplies may belong here but are not safe to attach yet.

### 16. Marhamat chicken — exact

- Strepsi
- Naggetsi
- Qanot
- File
- Burger go'shti
- Portsiya
- Un
- Pizza go'shti

### 17. Go'sht do'kon — unresolved

- See Andijon go'sht do'koni. The meat photos do not identify which operational supplier delivered them.

### 18. Tanxo — strong operational mapping

Printed distributor: ASMARKET. The Tanho-branded items make the operational mapping strong:

- Akbel sir
- Ketchup Tanho `Euro Vkus`, sachet 25 g
- Sauce Tanho `Syrnyy`, sachet 25 g
- Mayonnaise Tanho `Provansal-Burger 40%`, 5 kg
- Sauce Picanto `Syrnyy 30%`, 800 g
- Ketchup Tanho `Sladkiy`, 950 g
- Sauce Tanho `Chili`, 330 g
- IBRAT tomat, 1 L

### 19. Idishchi — exact

- PERCHATKA QORA L `BELARUS` (10)
- AK-001 MUZQAYMOQ 125 IDISHCHI (1000)
- ECO-016 MUZ 125 ECO (1000)
- ECO-027 QOG'OZ KOSA KATTA BEZ KR ECO (100)
- ECO-034 QOG'OZ KOSA O'RTA BEZ KR ECO (300) ATLAS
- DK-065 DESERT 150 ML DK (1000)
- FNP QOSHIQ KICHIK (100x100), colored
- FNP-031 QOSHIQ KICHIK (100x100)
- FNP-053 RAMA 1 L FNP QORA (250)
- FNP-063 SOUS 50 ML FNP (1600)
- FNP-073 TRUBKA 400 TALIK QORA (15)
- FNP-096 QOSHIQ KG QORA (10 KG)
- OSQ-048 FREE KICHIK (M) OSQ (50/900)
- PT-014 STAKAN CRAFT 330 ML PETRO (400)
- QOSHIQ 10 KG DESERT PP
- RUS-008 LOCHIN RUS (1100)
- TES-001 SOUS 50 ML IDISHCHI (1000)
- XT-009 SHEYKER (1000)
- ZM STAKAN ZM MATOVIY 500 PP GUMBAZ (300)
- ZM-051 5X KONTEYNER ZM (100)

### 20. Shaxrixon kraft — exact

- Lavash
- Lavash qizil
- Non burger 22
- List 28x40 — final handwritten/printed descriptor is unclear
- Paket 21
- Paket 27

These are kraft/packaging supplier item names, not proof of edible lavash stock.

### 21. Donar go'sht — unresolved

- See Andijon go'sht do'koni. No August image safely identifies the operational meat-supplier split.

### 22. Fri Azizbek aka — unresolved

- A physical delivery photo contains frozen-fries packages with a brand resembling `FRENCO/FREN...`.
- Group text also says `14 ta katlet`, but it does not safely identify the supplier.
- Confirm the fries brand and whether Fri and/or Katlet belong to Fri Azizbek aka.
- The recurring bakery-slip word is `Gril`, not `Fri`, and is not evidence for this supplier.

## Unassigned product families

### General grocery notes

- Yogurt / `yog'`
- `Mali` / `Marli` — spelling and product identity unclear
- `Chig'atoy` — spelling/product identity needs confirmation
- Saqich
- Tomat / tomato paste
- Tvorog
- Shakar
- Kofe
- Tuxum
- Lactel milk 2%
- Lactel milk 3%

Likely supplier choices: Majmua do'kon or Meva Asl market. The images do not decide between them.

### Anonymous market/wholesale notes

- AKBEL QASHQAR/QASHAR PISHLOG'I
- Other cheese / `syr`
- Salyami
- Ketchup
- Mayonnaise
- Nutella
- Mustard / gorchitsa — probable reading

Likely supplier choices: Meva Asl market, Majmua do'kon, or another meat/market supplier.

### TIM / SHERIN / ANDALUS

- SHERIN KANADA SASISKA
- SHERIN SALYAMI
- QAZI ANDALUS / QAZI BAYRAMONA ANDALUS

`TIM` is printed as the document name, but none of the 22 operational supplier names is proved.

### Micco drinks

- Micco 0.5 L Pear
- Micco 0.5 L Grape
- Micco 0.5 L Melon
- Micco 1 L Pear
- Micco 1 L Grape
- Micco 1 L Melon

The phone number is also seen on HONEST TRADE documents, but the correct operational mapping among Be Fresh, Moxito, Anor, or another supplier is unresolved.

### Other unassigned items

- Alif Peppermint Pillows
- Alif Strawberry & Banana Pillows
- Alif Watermelon Pillows
- Esviro liquid soap Aloe 500 ml
- Esviro liquid soap Forest 500 ml
- Esviro liquid soap Ocean 500 ml
- Elma Z dispenser paper napkins, 180 pcs
- Elma V 11 cm Horeca paper napkins, 150 pcs
- Elma wet wipes
- Syrup / shake supplies with unclear names
- Grill charcoal
- Boba/tapioca pearls and drink ingredients
- Frozen fries in packages branded approximately `FRENCO/FREN...`
- Trash bags / `musor`, gloves, and other handwritten cleaning/packing supplies
- Anonymous wrapped meat and XOJI OTA products

## Small human-review image set

These six originals are the smallest useful re-reading set. Routine scale photos are excluded. The Majmua/Meva Asl, Bozor Pomidor/Meva Asl, two-Bulochka, and three-meat-supplier splits cannot be recovered from the pixels; they need staff/source confirmation.

- [Anonymous wholesale list — identify supplier and raw product names](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts-agent/2026-08-15_111500_mid4294968435.jpg>)
- [Syrup/shake list — decide whether it belongs to Smes Muzqaymoq](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts-agent/2026-08-17_215800_mid4294968463.jpg>)
- [Second syrup/puree receipt — identify supplier and two product names](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts/2026-08-21_220409_mid4294968511.jpg>)
- [Dena invoice — confirm the complete legal supplier header](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts-agent/2026-08-12_134800_mid4294968398.jpg>)
- [Bakery slip — confirm `Gril` and choose the Bulochka supplier](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts/2026-08-29_131810_mid4294968590.jpg>)
- [Frozen-fries delivery — confirm brand and Fri Azizbek aka](<C:/Users/Jason/AppData/Local/Temp/smart-food-aug2026-receipts-agent/2026-08-15_154400_mid4294968440.jpg>)

## Deferred after user confirmation

- The units for `Fri` and `Kotlet` under Fri Azizbek aka are not decided.
- Andijon go'sht do'koni requires a later manager review.
- Shirinlik, Meva Asl market, and Go'sht do'kon intentionally remain without items for now.
- Unassigned evidence listed above must not be imported automatically.
