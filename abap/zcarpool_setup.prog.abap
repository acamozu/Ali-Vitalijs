*&---------------------------------------------------------------------*
*& Report ZCARPOOL_SETUP
*&---------------------------------------------------------------------*
*& Creates and activates the two tables of the carpool / transfer
*& planner app:
*&   ZCARPOOL_PLAN    one row per plan (settings, seat plan and rules
*&                    as a JSON document, version counter)
*&   ZCARPOOL_PERSON  the people of a plan, one row per person
*& Run once with F8. Tables that already exist are left alone.
*&---------------------------------------------------------------------*
REPORT zcarpool_setup.

DATA: gv_tab   TYPE tabname,
      gt_dd03p TYPE STANDARD TABLE OF dd03p WITH DEFAULT KEY.

START-OF-SELECTION.

  "                   field         key  data element  type    length    text
  gv_tab = 'ZCARPOOL_PLAN'.
  CLEAR gt_dd03p.
  PERFORM add_field USING 'MANDT'      'X' 'MANDT'     ''      '000000' ''.
  PERFORM add_field USING 'PLAN_ID'    'X' ''          'CHAR'  '000020' 'Plan ID'.
  PERFORM add_field USING 'NAME'       ''  ''          'CHAR'  '000080' 'Plan name'.
  PERFORM add_field USING 'VERSION'    ''  ''          'INT4'  '000010' 'Version, +1 with every save'.
  PERFORM add_field USING 'DOC'        ''  ''          'STRG'  '000000' 'Settings, seat plan, rules (JSON)'.
  PERFORM add_field USING 'CREATED_BY' ''  'SYUNAME'   ''      '000000' ''.
  PERFORM add_field USING 'CREATED_AT' ''  'TIMESTAMP' ''      '000000' ''.
  PERFORM add_field USING 'CHANGED_BY' ''  'SYUNAME'   ''      '000000' ''.
  PERFORM add_field USING 'CHANGED_AT' ''  'TIMESTAMP' ''      '000000' ''.
  PERFORM create_table USING 'Carpool planner: plans'.

  gv_tab = 'ZCARPOOL_PERSON'.
  CLEAR gt_dd03p.
  PERFORM add_field USING 'MANDT'      'X' 'MANDT'     ''      '000000' ''.
  PERFORM add_field USING 'PLAN_ID'    'X' ''          'CHAR'  '000020' 'Plan ID'.
  PERFORM add_field USING 'PERSON_ID'  'X' ''          'CHAR'  '000020' 'Person ID'.
  PERFORM add_field USING 'POS'        ''  ''          'INT4'  '000010' 'Position in the list'.
  PERFORM add_field USING 'NAME'       ''  ''          'CHAR'  '000080' 'Name'.
  PERFORM add_field USING 'CAR'        ''  'XFELD'     ''      '000000' ''.
  PERFORM add_field USING 'SEATS'      ''  ''          'INT4'  '000010' 'Seats of the car, driver included'.
  PERFORM add_field USING 'LEG1'       ''  'XFELD'     ''      '000000' ''.
  PERFORM add_field USING 'LEG2'       ''  'XFELD'     ''      '000000' ''.
  PERFORM add_field USING 'TEAM'       ''  ''          'CHAR'  '000040' 'Team'.
  PERFORM add_field USING 'LANG'       ''  ''          'CHAR'  '000002' 'Language (DE, EN, RU)'.
  PERFORM add_field USING 'NOTE'       ''  ''          'CHAR'  '000060' 'Note'.
  PERFORM create_table USING 'Carpool planner: people of a plan'.


FORM add_field USING iv_field TYPE clike
                     iv_key   TYPE clike
                     iv_roll  TYPE clike
                     iv_type  TYPE clike
                     iv_leng  TYPE clike
                     iv_text  TYPE clike.
  DATA ls_dd03p TYPE dd03p.
  ls_dd03p-tabname    = gv_tab.
  ls_dd03p-fieldname  = iv_field.
  ls_dd03p-position   = lines( gt_dd03p ) + 1.
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
  APPEND ls_dd03p TO gt_dd03p.
ENDFORM.


FORM create_table USING iv_text TYPE clike.
  DATA: ls_dd02v TYPE dd02v,
        ls_dd09v TYPE dd09v,
        lv_rc    TYPE sy-subrc.

  SELECT SINGLE tabname FROM dd02l INTO @DATA(lv_found)
    WHERE tabname = @gv_tab.
  IF sy-subrc = 0.
    WRITE: / gv_tab, 'already exists - left alone.'.
    RETURN.
  ENDIF.

  ls_dd02v-tabname    = gv_tab.
  ls_dd02v-ddlanguage = 'E'.
  ls_dd02v-tabclass   = 'TRANSP'.
  ls_dd02v-ddtext     = iv_text.
  ls_dd02v-contflag   = 'A'.        " application data
  ls_dd02v-mainflag   = 'X'.        " SE16 display and maintenance allowed
  ls_dd02v-exclass    = '1'.        " cannot be enhanced

  ls_dd09v-tabname  = gv_tab.
  ls_dd09v-tabkat   = '0'.
  ls_dd09v-tabart   = 'APPL1'.
  ls_dd09v-bufallow = 'N'.

  CALL FUNCTION 'DDIF_TABL_PUT'
    EXPORTING
      name      = gv_tab
      dd02v_wa  = ls_dd02v
      dd09l_wa  = ls_dd09v
    TABLES
      dd03p_tab = gt_dd03p
    EXCEPTIONS
      OTHERS    = 1.
  IF sy-subrc <> 0.
    WRITE: / 'ERROR', gv_tab, ': DDIF_TABL_PUT failed, sy-subrc =', sy-subrc.
    RETURN.
  ENDIF.

  " object directory entry: local object ($TMP)
  CALL FUNCTION 'TR_TADIR_INTERFACE'
    EXPORTING
      wi_test_modus       = ' '
      wi_tadir_pgmid      = 'R3TR'
      wi_tadir_object     = 'TABL'
      wi_tadir_obj_name   = CONV sobj_name( gv_tab )
      wi_tadir_author     = sy-uname
      wi_tadir_devclass   = '$TMP'
      wi_tadir_masterlang = 'E'
    EXCEPTIONS
      OTHERS              = 1.
  IF sy-subrc <> 0.
    WRITE: / 'ERROR', gv_tab, ': object directory entry failed, sy-subrc =', sy-subrc.
    RETURN.
  ENDIF.

  CALL FUNCTION 'DDIF_TABL_ACTIVATE'
    EXPORTING
      name     = gv_tab
      auth_chk = ' '
    IMPORTING
      rc       = lv_rc
    EXCEPTIONS
      OTHERS   = 1.
  IF sy-subrc <> 0 OR lv_rc > 4.
    WRITE: / 'ERROR', gv_tab, ': activation failed, sy-subrc =', sy-subrc, 'rc =', lv_rc.
    WRITE: / 'See the activation log of the table in SE11.'.
    RETURN.
  ENDIF.

  WRITE: / 'OK:', gv_tab, 'created and activated, rc =', lv_rc.
ENDFORM.
