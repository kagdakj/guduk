import os
import json
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from ai_parser import analyze_subscriptions

load_dotenv()

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calendar')
def calendar():
    return render_template('calendar.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text']

    try:
        result = analyze_subscriptions(text)
        return jsonify(result)
    except Exception as e:
        print(f"Error during analysis: {e}")
        return jsonify({'error': 'Analysis failed. Please try again.'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
