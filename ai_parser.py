import os
import json
import re
from openai import OpenAI

def analyze_subscriptions(text):
    """
    Analyzes billing text to extract subscriptions with metadata,
    overlaps, price changes, trial conversions, and cycle mismatches.
    """
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=api_key, timeout=30.0)
    model = "gpt-4o-mini"

    system_prompt = """
You are an analytical financial tool for a Korean audience.
CRITICAL: All output text MUST be in Korean (한국어).
Extract data STRICTLY based on the pasted text. NEVER hallucinate.

Tasks:
1. Extract all recurring subscriptions with rich metadata:
   - name: service name in Korean
   - amount: integer KRW
   - frequency: "monthly" or "yearly"
   - category: Korean (OTT, 음악, 클라우드, 생산성, 통신, 게임, 뉴스, 기타)
   - estimated_billing_day: if the text contains a date, extract the day (1-31). If no date info, infer a reasonable day or use null.
   - note: infer the plan tier from the price (e.g. "넷플릭스 17,000원 → 프리미엄 요금제 추정", "스포티파이 7,900원 → 개인 요금제 추정"). If unknown, use null.

2. totals: Calculate monthly and yearly totals.

3. overlaps: Group services sharing a category where consolidation saves money.
   Include potential_yearly_savings and reason (Korean).

4. price_changes: ONLY when the pasted text explicitly contains two different amounts for the SAME service. Include previous_amount and current_amount.

5. trial_conversions: ONLY when phrases like "무료체험 종료", "첫 결제", "trial" appear. Include name and message (Korean).

6. cycle_mismatches: ONLY when evidence suggests the billing cycle differs from expectation. Include name and message (Korean).

Return ONLY a valid JSON object. No markdown fences, no explanation.
{
  "subscriptions": [
    {"name": "넷플릭스", "amount": 17000, "frequency": "monthly", "category": "OTT", "estimated_billing_day": 15, "note": "프리미엄 요금제 추정"}
  ],
  "totals": {"monthly": 0, "yearly": 0},
  "overlaps": [{"category": "OTT", "services": ["넷플릭스", "디즈니+"], "potential_yearly_savings": 118800, "reason": "같은 OTT 카테고리 구독이 중복됩니다."}],
  "price_changes": [{"name": "넷플릭스", "previous_amount": 13500, "current_amount": 17000}],
  "trial_conversions": [{"name": "유튜브 프리미엄", "message": "무료체험 종료 후 첫 결제 발생"}],
  "cycle_mismatches": [{"name": "어도비", "message": "월간 결제로 예상되나 연간 일시불로 청구됨"}]
}
If a category has no data, return an empty array for it.
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"다음은 사용자가 붙여넣은 결제 내역입니다:\n\n{text}"}
        ],
        temperature=0.0,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content.strip()

    match = re.search(r'\{.*\}', raw, re.DOTALL)
    json_str = match.group(0) if match else raw

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        print("JSON parse failed. Raw response:")
        print(raw)
        raise

    # Guarantee all keys exist
    data.setdefault("subscriptions", [])
    data.setdefault("totals", {"monthly": 0, "yearly": 0})
    data.setdefault("overlaps", [])
    data.setdefault("price_changes", [])
    data.setdefault("trial_conversions", [])
    data.setdefault("cycle_mismatches", [])

    # Guarantee metadata fields on each subscription
    for sub in data["subscriptions"]:
        sub.setdefault("estimated_billing_day", None)
        sub.setdefault("note", None)

    return data
