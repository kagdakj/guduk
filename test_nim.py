import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get('NVIDIA_NIM_API_KEY')
print(f"Key loaded: {bool(api_key)}")

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key,
    timeout=10.0
)

try:
    response = client.chat.completions.create(
        model="meta/llama-3.1-70b-instruct",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=10
    )
    print("Success:")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Error: {e}")
