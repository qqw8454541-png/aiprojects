import os

directory = '/root/aiprojects/mahjong-scorer/src'

replacements = [
    " || 'Rate Limit Exceeded'",
    " || 'Network/Auth Error'",
    " || 'Service Error'",
    " || 'Confirm'",
    " || 'Sign In'",
    " || 'Sign in with Apple'",
    " || 'Sign in with Google'",
    " || 'Email Login'",
    " || 'Phone Login'",
    " || 'your@email.com'",
    " || 'Resend'",
    " || 'Send'",
    " || 'Code sent!'",
    " || 'Verifying...'",
    " || 'Verify and Login'",
    " || 'By signing in, you agree to the Terms of Service and Privacy Policy.'",
    " || 'Login / Sign Up'",
    " || 'Unlock cloud sync & AI features'",
    " || 'Upgrade to Pro'",
    " || 'Sign Out'",
    " || 'M-League'",
    " || 'Mahjong Soul'",
    " || 'WRC'",
    " || 'Sanma Majsoul'",
    " || 'Sanma Standard'",
    " || 'Room name cannot be duplicated!'",
    " || 'Start Game'",
    " || 'Welcome to Pro!'",
    " || 'All premium features are now unlocked.'",
    " || 'Start Exploring'",
    " || 'Monthly subscription, cancel anytime'",
    " || '🎖️ Already Pro'",
    " || `Subscribe to Pro — ${priceDisplay}`"
]

count = 0
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            for rep in replacements:
                content = content.replace(rep, "")
                
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Updated {path}')
                count += 1

if count == 0:
    print('No files were updated.')
