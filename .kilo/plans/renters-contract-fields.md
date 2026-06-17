# Renters page contract/payment fields plan

## Goal
Update the agency renters page (`apps/web/src/app/agency/renters/page.tsx`) so each renter card shows key lease/payment context and the contract creation modal captures the missing fields requested by the user:
- Renter name
- Renter phone number
- Payment links / payment installments
- Lease start date
- Lease end date
- Payment method/frequency: month, quarter, half-year, year
- Lease contract number

## Current findings
- `AgencyRentersPage` already lists renters from `/api/contacts?type=tenant` and shows name, phone, alternative phone, email, ID number, sex, status, notes, and created date.
- The page already has an "إنشاء عقد" modal that creates contracts through `POST /api/contracts`.
- `ContractSchema` already stores `start_date`, `end_date`, `payment_frequency`, `rent_total_sar`, `installments_count`, `notes`, and `extra`.
- `ContractPaymentSchema` already stores payment installments through `contract_payments`.
- `POST /api/contracts` already accepts `payments[]` and auto-generates payments when no explicit payments are supplied.
- The existing frequency options include `monthly`, `quarterly`, `yearly`, `weekly`, and `one-time`; `half-yearly`/`semiannual` is not currently supported and should be added.
- There is no dedicated `contract_number` column in `ContractSchema`, so contract number should either be stored in `extra.contract_number` or added as a real column depending on desired persistence/queryability.

## Recommended implementation

### 1. Add contract data to renters
- Extend the `Renter` type with optional contract/payment fields if returned from a new API query, or keep it separate as `RenterContractSummary`.
- Add a query for active contracts by contact or fetch contracts once and map them by `contact_id`.
- Prefer using existing `/api/contracts` rather than adding a new API if the current response includes contract and payment data.
- For each renter, derive/display:
  - Active contract number
  - Lease start date
  - Lease end date
  - Payment frequency
  - Latest/next payment status and amount
  - Payment link/button if a payment URL/link exists or can be generated later

### 2. Add payment links
- If payment links already exist in another field/API, map that field into the renter card.
- If no payment-link model exists, add a non-blocking UI placeholder:
  - Button label: "وصلات الدفع"
  - Opens a small modal/table listing generated contract payments.
  - Each payment row shows amount, due date, status, and a placeholder action/link.
- Do not invent a real payment gateway integration unless the user confirms the provider.

### 3. Update the contract creation modal
Add fields to the existing modal:
- `رقم عقد الإيجار`
  - Text input.
  - Required before saving the contract.
- `طريقة الدفع`
  - Select with:
    - `monthly` = شهري
    - `quarterly` = ربع سنوي
    - `half-yearly` = نصف سنوي
    - `yearly` = سنوي
- Existing `إجمالي الإيجار` and `تاريخ البدء/النهاية` fields already cover rent amount and lease dates.
- Existing `عدد الدفعات` can remain optional.
- Pass `contract_number` to the API payload, ideally under `extra.contract_number` if no DB column exists yet.

### 4. Update API persistence
Preferred options:
1. Minimal change:
   - Store contract number in `contracts.extra` as `{ contract_number: "..." }`.
   - No database schema change required.
   - Read it back in the renters page from `contract.extra?.contract_number`.
2. More robust change:
   - Add `contract_number` column to `ContractSchema`.
   - Update `POST /api/contracts` to persist it.
   - Add DB sync/migration if production DB is not using `synchronize`.

Recommended for speed: use `extra.contract_number` first. Recommend DB column later for reporting/search.

### 5. UI changes on renter cards
Add a compact section under contact details:
- `رقم العقد: ...`
- `بداية العقد: ...`
- `نهاية العقد: ...`
- `طريقة الدفع: ...`
- `وصلات الدفع: عرض`
- If no contract exists, show "لا يوجد عقد نشط".

### 6. Validation
- Add validation for end date after start date.
- Add validation for payment frequency.
- Add validation for contract number if made required.
- Keep Arabic labels consistent with existing UI.

## Files likely to change
- `apps/web/src/app/agency/renters/page.tsx`
- `apps/web/src/lib/db/entities/contract.ts` only if adding a real `contract_number` column
- `apps/web/src/app/api/contracts/route.ts` only if persisting `contract_number` outside `extra`
- `apps/web/src/lib/db/entities/index.ts` only if adding payment-link/payment-method fields to `ContractPaymentSchema`

## Risks / decisions needed
- Should "رقم عقد الإيجار" be required?
- What exactly is meant by "وصلات الدفع": payment installment links, downloadable receipts, or payment gateway links?
- Should half-yearly payments be added as `half-yearly`?
- Should contract/payment data be fetched from a new dedicated renters endpoint or derived from existing contracts/payments APIs?
