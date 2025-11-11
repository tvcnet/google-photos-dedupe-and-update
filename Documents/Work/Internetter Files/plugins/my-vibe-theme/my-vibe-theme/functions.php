<?php
/**
 * ===============================================================
 *  THEME CORE: Vibe Theme Functions
 * ===============================================================
 */

/**
 * Enqueue scripts and styles for the theme.
 */
function my_vibe_theme_assets() {
    // 1. Load main stylesheet (theme header). Use filemtime for cache-busting.
    $style_css_path = get_stylesheet_directory() . '/style.css';
    $style_css_ver  = file_exists( $style_css_path ) ? filemtime( $style_css_path ) : null;
    wp_enqueue_style(
        'my-vibe-styles',
        get_stylesheet_uri(),
        array(),
        $style_css_ver
    );

    // 2. Load custom CSS with cache-busting.
    $main_css_path = get_template_directory() . '/main.css';
    $main_css_ver  = file_exists( $main_css_path ) ? filemtime( $main_css_path ) : null;
    wp_enqueue_style(
        'my-vibe-main-css',
        get_template_directory_uri() . '/main.css',
        array(),
        $main_css_ver
    );

    // 3. Load Tailwind CDN (toggle via Customizer)
    $enable_tailwind = (bool) get_theme_mod( 'my_vibe_enable_tailwind_cdn', true );
    if ( $enable_tailwind ) {
        wp_enqueue_script(
            'tailwind-cdn',
            'https://cdn.tailwindcss.com',
            array(),
            null,
            false
        );
    }

    // 4. Load custom JS with cache-busting.
    $app_js_path = get_template_directory() . '/app.js';
    $app_js_ver  = file_exists( $app_js_path ) ? filemtime( $app_js_path ) : null;
    wp_enqueue_script(
        'my-vibe-main-js',
        get_template_directory_uri() . '/app.js',
        array(),
        $app_js_ver,
        true
    );
}
add_action( 'wp_enqueue_scripts', 'my_vibe_theme_assets' );

/**
 * Theme setup: supports and editor styles
 */
function my_vibe_theme_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );

    // Block editor styles
    add_theme_support( 'editor-styles' );
    add_editor_style( 'main.css' );

    // i18n
    load_theme_textdomain( 'my-vibe-theme', get_template_directory() . '/languages' );
}
add_action( 'after_setup_theme', 'my_vibe_theme_setup' );

/**
 * ===================================================================
 * 1. Add GLOBAL Header/Footer Script fields (Customizer)
 * ===================================================================
 */
function my_vibe_customize_register( $wp_customize ) {
    $wp_customize->add_section( 'my_vibe_scripts_section', array(
        'title'       => __( 'Global Header/Footer Scripts', 'my-vibe-theme' ),
        'priority'    => 30,
        'description' => __( 'Scripts/styles loaded on every page.', 'my-vibe-theme' ),
    ) );

    // Header scripts
    $wp_customize->add_setting( 'my_vibe_header_scripts', array(
        'type' => 'theme_mod',
        'capability' => 'edit_theme_options',
        'sanitize_callback' => 'my_vibe_sanitize_global_header_scripts',
    ) );
    $wp_customize->add_control( 'my_vibe_header_scripts', array(
        'label' => __( 'Global Header Scripts', 'my-vibe-theme' ),
        'section' => 'my_vibe_scripts_section',
        'type' => 'textarea',
        'description' => __( 'Added before </head>.', 'my-vibe-theme' ),
    ) );

    // Footer scripts
    $wp_customize->add_setting( 'my_vibe_footer_scripts', array(
        'type' => 'theme_mod',
        'capability' => 'edit_theme_options',
        'sanitize_callback' => 'my_vibe_sanitize_global_footer_scripts',
    ) );
    $wp_customize->add_control( 'my_vibe_footer_scripts', array(
        'label' => __( 'Global Footer Scripts', 'my-vibe-theme' ),
        'section' => 'my_vibe_scripts_section',
        'type' => 'textarea',
        'description' => __( 'Added before </body>.', 'my-vibe-theme' ),
    ) );

    // Assets & Performance section
    $wp_customize->add_section( 'my_vibe_assets_section', array(
        'title'       => __( 'Assets & Performance', 'my-vibe-theme' ),
        'priority'    => 31,
        'description' => __( 'Control loading of frontend assets.', 'my-vibe-theme' ),
    ) );

    // Toggle Tailwind CDN
    $wp_customize->add_setting( 'my_vibe_enable_tailwind_cdn', array(
        'type' => 'theme_mod',
        'capability' => 'edit_theme_options',
        'default' => true,
        'sanitize_callback' => 'my_vibe_sanitize_checkbox',
    ) );
    $wp_customize->add_control( 'my_vibe_enable_tailwind_cdn', array(
        'label' => __( 'Enable Tailwind CDN', 'my-vibe-theme' ),
        'section' => 'my_vibe_assets_section',
        'type' => 'checkbox',
        'description' => __( 'Disable for production performance if using a compiled CSS.', 'my-vibe-theme' ),
    ) );
}
add_action( 'customize_register', 'my_vibe_customize_register' );

/**
 * Sanitize callbacks for Customizer global script fields.
 * Admins with unfiltered_html keep raw; others get a safe subset.
 */
function my_vibe_sanitize_global_header_scripts( $value ) {
    $value = (string) $value;
    if ( current_user_can( 'unfiltered_html' ) ) {
        return $value;
    }
    // Allow only <style> in header for non-privileged users
    $allowed = array(
        'style' => array(
            'type'  => true,
            'media' => true,
        ),
    );
    return wp_kses( $value, $allowed );
}

function my_vibe_sanitize_global_footer_scripts( $value ) {
    $value = (string) $value;
    if ( current_user_can( 'unfiltered_html' ) ) {
        return $value;
    }
    // Allow <style> and simple <script> in footer for non-privileged users
    $allowed = array(
        'style'  => array(
            'type'  => true,
            'media' => true,
        ),
        'script' => array(
            'type'  => true,
            'src'   => true,
            'defer' => true,
            'async' => true,
        ),
    );
    return wp_kses( $value, $allowed );
}

/**
 * ===================================================================
 * 2. Add PER-PAGE Header/Footer Script fields (Meta Boxes)
 * ===================================================================
 */
function my_vibe_add_scripts_meta_box() {
    // Show only to users allowed to post unfiltered HTML
    if ( current_user_can( 'unfiltered_html' ) ) {
        add_meta_box(
            'my_vibe_page_scripts',
            'Per-Page Header/Footer Scripts',
            'my_vibe_render_scripts_meta_box',
            'page',
            'normal',
            'low'
        );
    }
}
add_action( 'add_meta_boxes', 'my_vibe_add_scripts_meta_box' );

// Sanitize checkbox values from Customizer/forms
function my_vibe_sanitize_checkbox( $checked ) {
    return ( isset( $checked ) && ( true == $checked || '1' === $checked || 1 === $checked ) ) ? 1 : 0;
}

function my_vibe_render_scripts_meta_box( $post ) {
    wp_nonce_field( 'my_vibe_save_scripts_meta_data', 'my_vibe_scripts_meta_box_nonce' );

    $header_scripts = get_post_meta( $post->ID, '_my_vibe_header_scripts', true );
    $footer_scripts = get_post_meta( $post->ID, '_my_vibe_footer_scripts', true );

    echo '<p>Add scripts or styles that load <strong>only</strong> on this page.</p>';
    echo '<label><strong>Header Scripts & Styles</strong></label>';
    echo '<textarea name="my_vibe_header_scripts_field" style="width:100%;height:150px;">' . esc_textarea( $header_scripts ) . '</textarea>';
    echo '<br><br><label><strong>Footer Scripts</strong></label>';
    echo '<textarea name="my_vibe_footer_scripts_field" style="width:100%;height:150px;">' . esc_textarea( $footer_scripts ) . '</textarea>';
}

function my_vibe_save_scripts_meta_data( $post_id ) {
    if ( ! isset( $_POST['my_vibe_scripts_meta_box_nonce'] ) ||
         ! wp_verify_nonce( $_POST['my_vibe_scripts_meta_box_nonce'], 'my_vibe_save_scripts_meta_data' ) ||
         ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) ||
         ! current_user_can( 'edit_page', $post_id ) ) {
        return;
    }

    $header_input = isset( $_POST['my_vibe_header_scripts_field'] ) ? (string) $_POST['my_vibe_header_scripts_field'] : '';
    $footer_input = isset( $_POST['my_vibe_footer_scripts_field'] ) ? (string) $_POST['my_vibe_footer_scripts_field'] : '';

    // If the user can post unfiltered HTML, store exactly what they entered.
    if ( current_user_can( 'unfiltered_html' ) ) {
        $header_value = $header_input;
        $footer_value = $footer_input;
    } else {
        // Otherwise, allow a safe subset. For header, allow styles; for footer, allow styles and simple scripts.
        $allowed_header = array(
            'style' => array(
                'type'  => true,
                'media' => true,
            ),
        );
        $allowed_footer = array(
            'style'  => $allowed_header['style'],
            'script' => array(
                'type'  => true,
                'src'   => true,
                'defer' => true,
                'async' => true,
            ),
        );

        $header_value = wp_kses( $header_input, $allowed_header );
        $footer_value = wp_kses( $footer_input, $allowed_footer );
    }

    update_post_meta( $post_id, '_my_vibe_header_scripts', $header_value );
    update_post_meta( $post_id, '_my_vibe_footer_scripts', $footer_value );
}
add_action( 'save_post', 'my_vibe_save_scripts_meta_data' );

/**
 * ===================================================================
 * 3. Print GLOBAL + PER-PAGE Scripts into Theme
 * ===================================================================
 */
function my_vibe_print_header_scripts() {
    $global_header = get_theme_mod( 'my_vibe_header_scripts' );
    if ( $global_header ) echo "\n<!-- Global Header Scripts -->\n$global_header\n<!-- End -->\n";

    if ( is_singular() ) {
        $page_header = get_post_meta( get_queried_object_id(), '_my_vibe_header_scripts', true );
        if ( $page_header ) echo "\n<!-- Page Header Scripts -->\n$page_header\n<!-- End -->\n";
    }
}
add_action( 'wp_head', 'my_vibe_print_header_scripts', 999 );

function my_vibe_print_footer_scripts() {
    $global_footer = get_theme_mod( 'my_vibe_footer_scripts' );
    if ( $global_footer ) echo "\n<!-- Global Footer Scripts -->\n$global_footer\n<!-- End -->\n";

    if ( is_singular() ) {
        $page_footer = get_post_meta( get_queried_object_id(), '_my_vibe_footer_scripts', true );
        if ( $page_footer ) echo "\n<!-- Page Footer Scripts -->\n$page_footer\n<!-- End -->\n";
    }
}
add_action( 'wp_footer', 'my_vibe_print_footer_scripts', 999 );

/**
 * ===================================================================
 * 4. Remove wpautop for the Vibe Canvas template
 * ===================================================================
 */
function my_vibe_remove_wpautop_for_canvas() {
    if ( is_page_template( 'template-vibe-canvas.php' ) ) {
        remove_filter( 'the_content', 'wpautop' );
    }
}
add_action( 'template_redirect', 'my_vibe_remove_wpautop_for_canvas', 1 );

/**
 * ===================================================================
 * 5. Visual Editor Integration for Vibe Canvas
 * Note: Editor styles are now handled in my_vibe_theme_setup().
 * ===================================================================
 */

// Allow raw HTML and custom elements inside TinyMCE
add_filter( 'tiny_mce_before_init', function( $init ) {
    global $post;

    if ( empty( $post ) || ! isset( $post->ID ) ) {
        return $init;
    }

    // Auto-apply per-page <style> CSS to visual editor
    // Use only the FIRST <style> block for stability (avoids TinyMCE errors on invalid CSS)
    $custom_css = get_post_meta( $post->ID, '_my_vibe_header_scripts', true );
    if ( $custom_css && strpos( $custom_css, '<style' ) !== false ) {
        if ( preg_match( '/<style[^>]*>(.*?)<\/style>/is', $custom_css, $match ) ) {
            $inline_css = isset( $match[1] ) ? trim( (string) $match[1] ) : '';
            // Safety: cap size to avoid overlong content_style causing init issues
            if ( $inline_css && strlen( $inline_css ) > 20000 ) {
                $inline_css = substr( $inline_css, 0, 20000 );
            }
            if ( $inline_css ) {
                $init['content_style'] = ( $init['content_style'] ?? '' ) . "\n" . $inline_css;
            }
        }
    }

    // Relax TinyMCE only for users allowed to post unfiltered HTML.
    if ( current_user_can( 'unfiltered_html' ) ) {
        $init['extended_valid_elements'] = 'div[*],section[*],header[*],footer[*],script[*],style[*],canvas[*],svg[*]';
        $init['verify_html'] = false;
        $init['cleanup'] = false;
    }

    return $init;
});
