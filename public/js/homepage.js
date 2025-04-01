  console.log("Loaded");
  $(document).ready(function() {
    $('#button_mono').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono"
        window.location.href = newUrl;
    });
    $('#button_mono_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono_train"
        window.location.href = newUrl;
    });

    $('#button_mono360').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono360"
        window.location.href = newUrl;
    });
    $('#button_mono360_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono360_train"
        window.location.href = newUrl;
    });
    $('#button_mono_video').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono_video"
        window.location.href = newUrl;
    });
    $('#button_mono_video_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono_video_train"
        window.location.href = newUrl;
    });

    $('#button_mono_360_video').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono_360_video"
        window.location.href = newUrl;
    });
    
    $('#button_mono_360_video_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "mono_360_video_train"
        window.location.href = newUrl;
    });


    $('#button_stereo').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "stereo"
        window.location.href = newUrl;
    });
    $('#button_stereo_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "stereo_train"
        window.location.href = newUrl;
    });


    $('#button_stereo_video').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "stereo_video"
        window.location.href = newUrl;
    });

    $('#button_stereo_video_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "stereo_video_train"
        window.location.href = newUrl;
    });

    $('#button_lightfield').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "lightfield"
        window.location.href = newUrl;
    });

    $('#button_lightfield_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "lightfield_train"
        window.location.href = newUrl;
    });

    $('#button_lightfield_refocus').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "lightfield_focus"
        window.location.href = newUrl;
    });
    $('#button_lightfield_refocus_train').on('click',()=>{
        var currentUrl = window.location.href;
        var newUrl = currentUrl + "lightfield_focus_train"
        window.location.href = newUrl;
    });
});