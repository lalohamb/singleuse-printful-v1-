import urllib.request, json, os, re

def get_env(key):
    with open(".env.local") as f:
        for line in f:
            m = re.match(rf'^{key}=(.+)', line.strip())
            if m: return m.group(1).strip('"\'')
    return ""

token = get_env("SUPABASE_ACCESS_TOKEN")
url = "https://api.supabase.com/v1/projects/ntdjsbtzndqebkikkdkm/database/query"

policies = {
    "refund": "<h2>Refund and Returns Policy</h2><p>Because every item is made to order, we do not accept returns or exchanges for buyer's remorse or incorrect size selection. Please review our size guide carefully before placing your order.</p><p>If your item arrives damaged, defective, or incorrect, we will make it right. Contact us within 30 days of delivery with your order number and a clear photo of the issue. We will offer a replacement or full refund at our discretion.</p><p>Refunds are processed to the original payment method within 5-10 business days of approval. Shipping costs are non-refundable unless the return is due to our error.</p><p>To initiate a return or report an issue, please contact us at the email listed in the footer of this site.</p>",
    "terms": "<h2>Terms of Service</h2><p>These Terms of Service govern your use of this website and any purchases made through it. By placing an order, you agree to these terms in full.</p><p>All products are made to order and may require 3-7 business days for production before shipping. Delivery times vary by location and carrier. We are not responsible for delays caused by shipping carriers or customs.</p><p>Prices are listed in USD and are subject to change without notice. We reserve the right to cancel or refuse any order at our discretion. In the event of a cancellation, you will be notified and refunded in full.</p><p>All content on this site including images, text, and designs is the property of this store and may not be reproduced without written permission.</p><p>By using this site, you agree that your use is at your own risk. We are not liable for any indirect, incidental, or consequential damages arising from your use of this website or its products.</p>"
}

for pid, content in policies.items():
    query = f"UPDATE policies SET content = $policy${content}$policy$, updated_at = now() WHERE id = '{pid}';"
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(url, data=data, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST")
    res = urllib.request.urlopen(req)
    print(f"{pid}: HTTP {res.status}")
