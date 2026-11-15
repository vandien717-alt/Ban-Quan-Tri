// Main JavaScript for Becamex BQT website

document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  const nav = document.querySelector('.main-nav');
  const container = nav.querySelector('.container');
  
  // Add mobile menu button for small screens
  const menuToggle = document.createElement('button');
  menuToggle.className = 'mobile-menu-toggle';
  menuToggle.innerHTML = '<i class="fas fa-bars"></i> Menu';
  menuToggle.style.cssText = 'display:none;background:var(--secondary);color:var(--primary-dark);border:none;padding:10px 15px;font-weight:700;border-radius:5px;cursor:pointer;width:100%;margin:8px 0;';
  container.prepend(menuToggle);
  
  menuToggle.addEventListener('click', function() {
    const navMenu = container.querySelector('.nav-menu');
    navMenu.style.display = navMenu.style.display === 'none' ? 'flex' : 'none';
  });

  // Search box focus effect
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        alert('Tính năng tìm kiếm sẽ được kết nối với dữ liệu thực tế.');
      }
    });
  }

  // Animate service cards on scroll
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  document.querySelectorAll('.service-card, .content-box').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
  });

  // Dynamic year update
  const yearSpan = document.querySelector('.footer-right p');
  if (yearSpan) {
    yearSpan.innerHTML = yearSpan.innerHTML.replace(/\d{4}/, new Date().getFullYear());
  }
});
