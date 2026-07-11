document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  
  if(hamburger) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      if(navLinks) navLinks.classList.remove('active');
      const target = document.querySelector(this.getAttribute('href'));
      if(target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });

  // Form Submit with Web3Forms (AJAX)
  const contactForm = document.getElementById('contactForm');
  if(contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // 阻止默认的表单跳转行为
      
      const formData = new FormData(contactForm);
      
      const isEnglish = document.documentElement.lang === 'en';

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.textContent = isEnglish ? 'Sending...' : '送信中...';
      submitBtn.disabled = true;

      try {
        // 在后台悄悄发送数据，不引起页面跳转
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
        });
        
        const data = await response.json();

        if (data.success) {
          // 自定义成功提示
          alert(isEnglish ? 'Thank you. Your inquiry has been sent. We will contact you shortly.' : 'ありがとうございます。お問い合わせを送信しました。後ほど担当者よりご連絡いたします。');
          contactForm.reset();
        } else {
          console.error('Error:', data);
          alert(isEnglish ? 'An error occurred: ' + data.message : 'エラーが発生しました: ' + data.message);
        }
      } catch (error) {
        console.error('Network Error:', error);
        alert(isEnglish ? 'A network error occurred. Please try again.' : '通信エラーが発生しました。もう一度お試しください。');
      } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }
});
