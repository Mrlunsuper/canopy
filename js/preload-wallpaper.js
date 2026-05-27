(function(){
  var wp = localStorage.getItem('desktop_tab_wallpaper');
  if (!wp || wp === 'default') return;
  var el = document.getElementById('desktop');
  if (!el) return;
  var m = {
    aurora:'wallpaper-aurora', sunset:'wallpaper-sunset', rose:'wallpaper-rose',
    forest:'wallpaper-forest', desert:'wallpaper-desert', midnight:'wallpaper-midnight',
    neon:'wallpaper-neon', candy:'wallpaper-candy', arctic:'wallpaper-arctic',
    lava:'wallpaper-lava', teal:'wallpaper-teal', sakura:'wallpaper-sakura',
    cosmic:'wallpaper-cosmic', copper:'wallpaper-copper', slate:'wallpaper-slate',
    jungle:'wallpaper-jungle', galaxy:'wallpaper-galaxy'
  };
  if (wp.startsWith('data:') || wp.startsWith('http')) {
    el.style.backgroundImage = "url('" + wp + "')";
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    if (wp.startsWith('http')) {
      el.classList.add('wallpaper-loading');
    }
  } else if (m[wp]) {
    el.classList.add(m[wp]);
  }
})();
