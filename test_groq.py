from groq import Groq

import os
GROQ_KEY = os.environ.get('GROQ_API_KEY', '')
c = Groq(api_key=GROQ_KEY)

# Test with qwen/qwen3.8-27b (available on this account)
MODEL = 'qwen/qwen3.8-27b'

prompt = """You are an educational image classifier. Output ONLY JSON, no markdown.
Teacher request: draw a cow outline for class 3 colouring page

JSON:
{
  "type": "outline",
  "subject": "cow",
  "colour": "bw",
  "age_group": "8-9",
  "use": "print_classroom",
  "complexity": 1,
  "safe": true,
  "confidence": 0.95,
  "key": "outline:cow",
  "needs_confirmation": false,
  "options": []
}"""

resp = c.chat.completions.create(
    model=MODEL,
    messages=[{'role': 'user', 'content': prompt}],
    temperature=0.1,
    max_tokens=300,
)
print('[GROQ OK] Model:', resp.model)
print('[RESPONSE]', resp.choices[0].message.content)
