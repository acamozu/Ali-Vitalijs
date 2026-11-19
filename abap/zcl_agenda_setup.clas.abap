CLASS zcl_agenda_setup DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  " One-time setup of the live agenda app (Year-End Conference), run with F9 in ADT (console application).
  " Every step leaves alone what already exists, so the class can be run again at any time.
  "   1. tables   ZAGENDA_EVENT  one row per event (title, date, venue ...)
  "               ZAGENDA_ITEM   the agenda items of an event, one row per item
  "   2. OData    model ZAGENDA_MDL 0001 -> class ZCL_AGENDA_MPC
  "               service ZAGENDA_SRV 0001 -> class ZCL_AGENDA_DPC
  "               (same API as the transactions /IWBEP/REG_MODEL and /IWBEP/REG_SERVICE)
  "   3. Gateway  the service is added and activated (as /IWFND/MAINT_SERVICE -> Add Service does), alias LOCAL
  " Steps 2 and 3 need the two classes; as long as they do not exist the run stops after step 1 and says so.
  " The classes need the tables, hence the order: run -> create ZCL_AGENDA_MPC / _DPC -> run again.
  " The agenda itself is written by ZCL_AGENDA_DATA.

  PUBLIC SECTION.

    INTERFACES if_oo_adt_classrun .

  PRIVATE SECTION.

    CONSTANTS: gc_model   TYPE /iwbep/med_mdl_technical_name VALUE 'ZAGENDA_MDL',
               gc_service TYPE /iwbep/med_grp_technical_name VALUE 'ZAGENDA_SRV',
               gc_version TYPE /iwbep/med_grp_version        VALUE '0001',
               gc_mpc     TYPE seoclsname                    VALUE 'ZCL_AGENDA_MPC',
               gc_dpc     TYPE seoclsname                    VALUE 'ZCL_AGENDA_DPC',
               gc_alias   TYPE /iwfnd/defi_system_alias      VALUE 'LOCAL'.

    DATA: mo_out   TYPE REF TO if_oo_adt_intrnl_classrun,
          mv_tab   TYPE tabname,
          mt_dd03p TYPE STANDARD TABLE OF dd03p WITH DEFAULT KEY.

    METHODS create_tables.

    METHODS add_field
      IMPORTING iv_field TYPE clike
                iv_key   TYPE clike DEFAULT ''
                iv_roll  TYPE clike DEFAULT ''
                iv_type  TYPE clike DEFAULT ''
                iv_leng  TYPE clike DEFAULT '000000'
                iv_text  TYPE clike DEFAULT ''.

    METHODS create_table
      IMPORTING iv_text TYPE clike.

    METHODS class_is_active
      IMPORTING iv_class         TYPE seoclsname
      RETURNING VALUE(rv_active) TYPE abap_bool.

    METHODS register_service
      RAISING /iwbep/cx_mgw_med_exception.

    METHODS activate_service.
ENDCLASS.



CLASS zcl_agenda_setup IMPLEMENTATION.


  METHOD if_oo_adt_classrun~main.
    mo_out = out.

    create_tables( ).

    IF class_is_active( gc_mpc ) = abap_false OR class_is_active( gc_dpc ) = abap_false.
      mo_out->write( |Classes { gc_mpc } / { gc_dpc } are not there (or not active) yet: create them, then run this class again.| ).
      RETURN.
    ENDIF.

    TRY.
        register_service( ).
        COMMIT WORK.
      CATCH /iwbep/cx_mgw_med_exception INTO DATA(lx_error).
        ROLLBACK WORK.
        mo_out->write( |ERROR registering the service: { lx_error->get_text( ) }| ).
        RETURN.
    ENDTRY.

    activate_service( ).
  ENDMETHOD.


  METHOD create_tables.
    "          field                 key            data element          type               length             text
    mv_tab = 'ZAGENDA_EVENT'.
    CLEAR mt_dd03p.
    add_field( iv_field = 'MANDT'      iv_key = 'X' iv_roll = 'MANDT' ).
    add_field( iv_field = 'EVENT_ID'   iv_key = 'X' iv_type = 'CHAR' iv_leng = '000020' iv_text = 'Event ID' ).
    add_field( iv_field = 'TITLE'                   iv_type = 'CHAR' iv_leng = '000080' iv_text = 'Title of the event' ).
    add_field( iv_field = 'COMPANY'                 iv_type = 'CHAR' iv_leng = '000080' iv_text = 'Company (host)' ).
    add_field( iv_field = 'EVENT_DATE'              iv_type = 'DATS' iv_leng = '000008' iv_text = 'Day of the event' ).
    add_field( iv_field = 'TZ'                      iv_type = 'CHAR' iv_leng = '000006' iv_text = 'UTC offset of the times, +01:00' ).
    add_field( iv_field = 'VENUE'                   iv_type = 'CHAR' iv_leng = '000080' iv_text = 'Venue' ).
    add_field( iv_field = 'CITY'                    iv_type = 'CHAR' iv_leng = '000040' iv_text = 'City' ).
    add_field( iv_field = 'ADDRESS'                 iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Address of the venue' ).
    add_field( iv_field = 'PUBLIC_URL'              iv_type = 'CHAR' iv_leng = '000255' iv_text = 'Address in the QR code (empty: app)' ).
    add_field( iv_field = 'CHANGED_BY'              iv_roll = 'SYUNAME' ).
    add_field( iv_field = 'CHANGED_AT'              iv_roll = 'TIMESTAMP' ).
    create_table( 'Live agenda: events' ).

    mv_tab = 'ZAGENDA_ITEM'.
    CLEAR mt_dd03p.
    add_field( iv_field = 'MANDT'       iv_key = 'X' iv_roll = 'MANDT' ).
    add_field( iv_field = 'EVENT_ID'    iv_key = 'X' iv_type = 'CHAR' iv_leng = '000020' iv_text = 'Event ID' ).
    add_field( iv_field = 'POS'         iv_key = 'X' iv_type = 'NUMC' iv_leng = '000004' iv_text = 'Position in the agenda' ).
    add_field( iv_field = 'ICON'                     iv_type = 'CHAR' iv_leng = '000010' iv_text = 'Icon (coffee, hand, chart ...)' ).
    add_field( iv_field = 'TIME_FROM'                iv_type = 'CHAR' iv_leng = '000005' iv_text = 'Start, HH:MM' ).
    add_field( iv_field = 'TIME_TO'                  iv_type = 'CHAR' iv_leng = '000005' iv_text = 'End, HH:MM (empty: until the next)' ).
    add_field( iv_field = 'ITEM_TYPE'                iv_type = 'CHAR' iv_leng = '000010' iv_text = 'session, break or social' ).
    add_field( iv_field = 'SECTION_DE'               iv_type = 'CHAR' iv_leng = '000040' iv_text = 'Part that starts here (German)' ).
    add_field( iv_field = 'SECTION_EN'               iv_type = 'CHAR' iv_leng = '000040' iv_text = 'Part that starts here (English)' ).
    add_field( iv_field = 'TITLE_DE'                 iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Title (German)' ).
    add_field( iv_field = 'TITLE_EN'                 iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Title (English)' ).
    add_field( iv_field = 'SUBTITLE_DE'              iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Subtitle (German)' ).
    add_field( iv_field = 'SUBTITLE_EN'              iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Subtitle (English)' ).
    add_field( iv_field = 'SPEAKER'                  iv_type = 'CHAR' iv_leng = '000060' iv_text = 'Speaker' ).
    add_field( iv_field = 'LOCATION'                 iv_type = 'CHAR' iv_leng = '000120' iv_text = 'Address (link to the map)' ).
    create_table( 'Live agenda: items of an event' ).
  ENDMETHOD.


  METHOD add_field.
    DATA ls_dd03p TYPE dd03p.
    ls_dd03p-tabname    = mv_tab.
    ls_dd03p-fieldname  = iv_field.
    ls_dd03p-position   = lines( mt_dd03p ) + 1.
    ls_dd03p-keyflag    = iv_key.
    ls_dd03p-notnull    = iv_key.
    ls_dd03p-ddlanguage = 'E'.
    IF iv_roll IS NOT INITIAL.
      ls_dd03p-rollname = iv_roll.
    ELSE.
      ls_dd03p-datatype = iv_type.
      ls_dd03p-leng     = iv_leng.
      ls_dd03p-ddtext   = iv_text.
    ENDIF.
    APPEND ls_dd03p TO mt_dd03p.
  ENDMETHOD.


  METHOD create_table.
    DATA: ls_dd02v TYPE dd02v,
          ls_dd09v TYPE dd09v,
          lv_rc    TYPE sy-subrc.

    SELECT SINGLE tabname FROM dd02l INTO @DATA(lv_found)
      WHERE tabname = @mv_tab.
    IF sy-subrc = 0.
      mo_out->write( |Table { mv_tab } already exists - left alone.| ).
      RETURN.
    ENDIF.

    ls_dd02v-tabname    = mv_tab.
    ls_dd02v-ddlanguage = 'E'.
    ls_dd02v-tabclass   = 'TRANSP'.
    ls_dd02v-ddtext     = iv_text.
    ls_dd02v-contflag   = 'A'.        " application data
    ls_dd02v-mainflag   = 'X'.        " SE16 display and maintenance allowed
    ls_dd02v-exclass    = '1'.        " cannot be enhanced

    ls_dd09v-tabname  = mv_tab.
    ls_dd09v-tabkat   = '0'.
    ls_dd09v-tabart   = 'APPL1'.
    ls_dd09v-bufallow = 'N'.

    CALL FUNCTION 'DDIF_TABL_PUT'
      EXPORTING
        name      = mv_tab
        dd02v_wa  = ls_dd02v
        dd09l_wa  = ls_dd09v
      TABLES
        dd03p_tab = mt_dd03p
      EXCEPTIONS
        OTHERS    = 1.
    IF sy-subrc <> 0.
      mo_out->write( |ERROR { mv_tab }: DDIF_TABL_PUT failed, sy-subrc = { sy-subrc }| ).
      RETURN.
    ENDIF.

    " object directory entry: local object ($TMP)
    CALL FUNCTION 'TR_TADIR_INTERFACE'
      EXPORTING
        wi_test_modus       = ' '
        wi_tadir_pgmid      = 'R3TR'
        wi_tadir_object     = 'TABL'
        wi_tadir_obj_name   = CONV sobj_name( mv_tab )
        wi_tadir_author     = sy-uname
        wi_tadir_devclass   = '$TMP'
        wi_tadir_masterlang = 'E'
      EXCEPTIONS
        OTHERS              = 1.
    IF sy-subrc <> 0.
      mo_out->write( |ERROR { mv_tab }: object directory entry failed, sy-subrc = { sy-subrc }| ).
      RETURN.
    ENDIF.

    CALL FUNCTION 'DDIF_TABL_ACTIVATE'
      EXPORTING
        name     = mv_tab
        auth_chk = ' '
      IMPORTING
        rc       = lv_rc
      EXCEPTIONS
        OTHERS   = 1.
    IF sy-subrc <> 0 OR lv_rc > 4.
      mo_out->write( |ERROR { mv_tab }: activation failed, sy-subrc = { sy-subrc }, rc = { lv_rc } - see the activation log in SE11.| ).
      RETURN.
    ENDIF.

    mo_out->write( |OK: table { mv_tab } created and activated, rc = { lv_rc }.| ).
  ENDMETHOD.


  METHOD class_is_active.
    " looked up by name: this class must not depend on the two service classes (they are created after the tables)
    SELECT SINGLE clsname FROM seoclassdf INTO @DATA(lv_name)
      WHERE clsname = @iv_class AND version = '1'.
    rv_active = xsdbool( sy-subrc = 0 ).
  ENDMETHOD.


  METHOD register_service.
    DATA: ls_model   TYPE /iwbep/cl_mgw_med_reg_api=>ty_s_model,
          ls_service TYPE /iwbep/cl_mgw_med_reg_api=>ty_s_service,
          lt_models  TYPE /iwbep/cl_mgw_med_reg_api=>ty_t_models,
          lv_package TYPE devclass,
          lv_exists  TYPE abap_bool.

    " ---------- model ----------
    TRY.
        /iwbep/cl_mgw_med_reg_api=>check_model_exists( iv_technical_name = gc_model iv_version = gc_version ).
        lv_exists = abap_true.
      CATCH /iwbep/cx_mgw_med_exception.
        lv_exists = abap_false.
    ENDTRY.
    IF lv_exists = abap_true.
      mo_out->write( |Model { gc_model } already exists - left alone.| ).
    ELSE.
      ls_model-technical_name = gc_model.
      ls_model-version        = gc_version.
      ls_model-description    = 'Live agenda'.
      ls_model-language       = sy-langu.
      ls_model-class_name     = gc_mpc.
      ls_model-created_by     = sy-uname.
      lv_package = '$TMP'.
      /iwbep/cl_mgw_med_reg_api=>create_model(
        EXPORTING is_model           = ls_model
                  iv_suppress_dialog = 'X'
        CHANGING  cv_package         = lv_package ).
      mo_out->write( |OK: model { gc_model } created.| ).
    ENDIF.

    " ---------- service ----------
    TRY.
        /iwbep/cl_mgw_med_reg_api=>check_service_exists( iv_technical_name = gc_service iv_version = gc_version ).
        lv_exists = abap_true.
      CATCH /iwbep/cx_mgw_med_exception.
        lv_exists = abap_false.
    ENDTRY.
    IF lv_exists = abap_true.
      mo_out->write( |Service { gc_service } already exists - left alone.| ).
    ELSE.
      ls_service-technical_name = gc_service.
      ls_service-version        = gc_version.
      ls_service-description    = 'Live agenda'.
      ls_service-language       = sy-langu.
      ls_service-class_name     = gc_dpc.
      ls_service-created_by     = sy-uname.
      lv_package = '$TMP'.
      /iwbep/cl_mgw_med_reg_api=>create_service(
        EXPORTING is_service         = ls_service
                  iv_suppress_dialog = 'X'
        CHANGING  cv_package         = lv_package ).
      mo_out->write( |OK: service { gc_service } created.| ).
    ENDIF.

    " ---------- model -> service ----------
    CLEAR: ls_service, lt_models.
    /iwbep/cl_mgw_med_reg_api=>get_service_details(
      EXPORTING iv_technical_name  = gc_service
                iv_version         = gc_version
      IMPORTING es_service         = ls_service
                et_assigned_models = lt_models ).
    READ TABLE lt_models TRANSPORTING NO FIELDS WITH KEY technical_name = gc_model version = gc_version.
    IF sy-subrc = 0.
      mo_out->write( |Model is already assigned to the service - left alone.| ).
    ELSE.
      /iwbep/cl_mgw_med_reg_api=>assign_model_to_service(
        iv_service_technical_name = gc_service
        iv_service_version        = gc_version
        iv_model_technical_name   = gc_model
        iv_model_version          = gc_version
        iv_suppress_dialog        = 'X' ).
      mo_out->write( |OK: model assigned to the service.| ).
    ENDIF.
  ENDMETHOD.


  METHOD activate_service.
    DATA lv_active TYPE abap_bool.

    TRY.
        DATA(lo_api) = /iwfnd/cl_mgw_activation_api=>get_instance( ).
        lo_api->is_active(
          EXPORTING iv_service_name    = gc_service
                    iv_service_version = gc_version
          IMPORTING ev_active          = lv_active ).
        IF lv_active = abap_true.
          mo_out->write( |Service { gc_service } is already active in the Gateway - left alone.| ).
        ELSE.
          lo_api->activate_service(
            iv_service_name    = gc_service
            iv_service_version = gc_version
            iv_system_alias    = gc_alias
            iv_package         = '$TMP' ).
          COMMIT WORK.
          mo_out->write( |OK: service { gc_service } added and activated in the Gateway (system alias { gc_alias }).| ).
        ENDIF.
        mo_out->write( |Done. Address: /sap/opu/odata/sap/{ gc_service }/| ).
      CATCH /iwfnd/cx_med_remote INTO DATA(lx_error).
        ROLLBACK WORK.
        mo_out->write( |ERROR activating the service: { lx_error->get_text( ) }| ).
        mo_out->write( |By hand: /IWFND/MAINT_SERVICE -> Add Service -> system alias { gc_alias } -> { gc_service }.| ).
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
