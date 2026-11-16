"! aESM check result as entry in S2S (SCHUFA_B)
CLASS zcl_esm_s2s_protocol DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    INTERFACES if_badi_interface .
    INTERFACES /aesm/ifb_check_finished .

  PRIVATE SECTION.
    TYPES:
      BEGIN OF ty_list,
        name       TYPE string,
        hits       TYPE i,
        total_hits TYPE i,
      END OF ty_list,
      BEGIN OF ty_answer,
        query_id   TYPE string,
        total_hits TYPE i,
        lists      TYPE STANDARD TABLE OF ty_list WITH EMPTY KEY,
      END OF ty_answer.

    "! Marks the S2S entries written by this class: AESM- plus request id
    CONSTANTS c_reference_prefix TYPE string VALUE `AESM-` ##NO_TEXT.

    METHODS write
      IMPORTING
        !is_flwcntr TYPE /aesm/db_flwcntr
        !iv_partner TYPE bu_partner .
    METHODS status_text
      IMPORTING
        !iv_status     TYPE /aesm/db_flwcntr-status
      RETURNING
        VALUE(rv_text) TYPE string .
ENDCLASS.



CLASS zcl_esm_s2s_protocol IMPLEMENTATION.


  METHOD /aesm/ifb_check_finished~check_finished.
    " Checks without partner number arrive later via PARTNER_ASSIGNED, when the partner is known
    CHECK is_flwcntr-external_object EQ /aesm/cl_partner_handler=>con_sap_partner_object.
    DATA(lv_partner) = CONV bu_partner( condense( is_flwcntr-external_reference ) ).
    write( is_flwcntr = is_flwcntr iv_partner = |{ lv_partner ALPHA = IN }| ).
  ENDMETHOD.


  METHOD /aesm/ifb_check_finished~partner_assigned.
    SELECT SINGLE * FROM /aesm/db_flwcntr WHERE request_id EQ @iv_request_id INTO @DATA(ls_flwcntr).
    IF sy-subrc EQ 0.
      write( is_flwcntr = ls_flwcntr iv_partner = iv_partner ).
    ENDIF.
  ENDMETHOD.


  METHOD write.
    TRY.
        " Only checks that really went to Schufa (not e.g. blocklist hits)
        SELECT response FROM /aesm/db_apilg
          WHERE guid EQ @is_flwcntr-guid
            AND code EQ 200
          ORDER BY crdat DESCENDING, crtim DESCENDING
          INTO @DATA(lv_response)
          UP TO 1 ROWS.
        ENDSELECT.
        IF sy-subrc NE 0.
          RETURN.
        ENDIF.

        " One S2S entry per check
        DATA(lv_reference) = CONV /s2ssws/dte_teilnehmerreferenz(
          |{ c_reference_prefix }{ is_flwcntr-request_id ALPHA = OUT }| ).
        SELECT SINGLE @abap_true FROM /s2ssws/db_out
          WHERE teilnehmerreferenz EQ @lv_reference INTO @DATA(lv_exists).
        IF lv_exists EQ abap_true.
          RETURN.
        ENDIF.

        DATA ls_answer TYPE ty_answer.
        /ui2/cl_json=>deserialize( EXPORTING json = lv_response CHANGING data = ls_answer ).

        " Person as in the partner master data; check data where the partner has nothing
        SELECT SINGLE name_first, name_last, birthdt, xsexf, xsexm
          FROM but000 WHERE partner EQ @iv_partner INTO @DATA(ls_but000).
        SELECT a~street, a~house_num1, a~post_code1, a~city1, a~country
          FROM but020 AS b INNER JOIN adrc AS a ON a~addrnumber EQ b~addrnumber
          WHERE b~partner EQ @iv_partner
          ORDER BY b~addrnumber
          INTO @DATA(ls_address)
          UP TO 1 ROWS.
        ENDSELECT.

        DATA(lv_firstname) = COND string( WHEN ls_but000-name_first IS NOT INITIAL
                                          THEN ls_but000-name_first ELSE is_flwcntr-firstname ).
        DATA(lv_lastname) = COND string( WHEN ls_but000-name_last IS NOT INITIAL
                                         THEN ls_but000-name_last ELSE is_flwcntr-lastname ).
        DATA(lv_gender) = COND char1( WHEN ls_but000-xsexf EQ abap_true THEN 'W'
                                      WHEN ls_but000-xsexm EQ abap_true THEN 'M' ).
        DATA(lv_street) = COND string( WHEN ls_address-street IS NOT INITIAL
                                       THEN condense( |{ ls_address-street } { ls_address-house_num1 }| )
                                       ELSE is_flwcntr-street ).
        DATA(lv_post_code) = COND string( WHEN ls_address-post_code1 IS NOT INITIAL
                                          THEN ls_address-post_code1 ELSE is_flwcntr-pocode ).
        DATA(lv_city) = COND string( WHEN ls_address-city1 IS NOT INITIAL
                                     THEN ls_address-city1 ELSE is_flwcntr-city ).
        DATA(lv_country) = COND string( WHEN ls_address-country IS NOT INITIAL
                                        THEN ls_address-country ELSE is_flwcntr-country ).

        DATA(lv_text) = |aESM Compliance-Check { is_flwcntr-status } { status_text( is_flwcntr-status ) }: |
                     && |{ ls_answer-total_hits } Treffer|.

        DATA(lv_guid) = cl_system_uuid=>create_uuid_x16_static( ).

        DATA(ls_head) = VALUE /s2ssws/db_head(
          daten_guid = lv_guid
          status     = 'AO' " Auskunft erfolgt
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        DATA(ls_partn) = VALUE /s2ssws/db_partn(
          guid       = cl_system_uuid=>create_uuid_x16_static( )
          daten_guid = lv_guid
          partner    = iv_partner
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        DATA(ls_in) = VALUE /s2ssws/db_in(
          daten_guid   = lv_guid
          vorname      = lv_firstname
          nachname     = lv_lastname
          geschlecht   = lv_gender
          geburtsdatum = ls_but000-birthdt
          strasse      = lv_street
          plz          = lv_post_code
          ort          = lv_city
          land         = lv_country
          auftragsart  = 'Compliance' ##NO_TEXT
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        DATA(ls_out) = VALUE /s2ssws/db_out(
          daten_guid         = lv_guid
          schufa_referenz    = ls_answer-query_id
          teilnehmerreferenz = lv_reference
          teilnehmerkennung  = COND #( WHEN is_flwcntr-parent_reference IS NOT INITIAL
                                       THEN is_flwcntr-parent_reference
                                       ELSE is_flwcntr-external_reference )
          vorname            = lv_firstname
          nachname           = lv_lastname
          geschlecht         = lv_gender
          geburtsdatum       = ls_but000-birthdt
          strasse            = lv_street
          plz                = lv_post_code
          ort                = lv_city
          land               = lv_country
          text               = lv_text
          ergebnistyp        = 'SCHUFA Compliance' ##NO_TEXT
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        DATA(ls_eva) = VALUE /s2ssws/db_eva(
          daten_guid = lv_guid
          partner    = iv_partner
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        DATA(ls_keyfg) = VALUE /s2ssws/db_keyfg(
          daten_guid = lv_guid
          crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
          chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ).

        " One detail line per Schufa list
        DATA lt_detail TYPE STANDARD TABLE OF /s2ssws/db_out_d WITH EMPTY KEY.
        LOOP AT ls_answer-lists INTO DATA(ls_list).
          APPEND VALUE #(
            guid         = cl_system_uuid=>create_uuid_x16_static( )
            daten_guid   = lv_guid
            beschreibung = |{ ls_list-name }: { ls_list-total_hits } Treffer|
            datum        = sy-datum
            typ          = 'compliance' ##NO_TEXT
            crusr = sy-uname crdat = sy-datum crtim = sy-uzeit
            chusr = sy-uname chdat = sy-datum chtim = sy-uzeit ) TO lt_detail.
        ENDLOOP.

        " No commit: the entry is saved together with the check
        INSERT /s2ssws/db_head FROM @ls_head.
        INSERT /s2ssws/db_partn FROM @ls_partn.
        INSERT /s2ssws/db_in FROM @ls_in.
        INSERT /s2ssws/db_out FROM @ls_out.
        INSERT /s2ssws/db_eva FROM @ls_eva.
        INSERT /s2ssws/db_keyfg FROM @ls_keyfg.
        IF lt_detail IS NOT INITIAL.
          INSERT /s2ssws/db_out_d FROM TABLE @lt_detail.
        ENDIF.

      CATCH cx_root ##CATCH_ALL ##NO_HANDLER.
        " Presentation only: the check itself must never fail because of this entry
    ENDTRY.
  ENDMETHOD.


  METHOD status_text.
    TRY.
        DATA(lt_values) = CAST cl_abap_elemdescr(
          cl_abap_typedescr=>describe_by_data( iv_status ) )->get_ddic_fixed_values( p_langu = 'D' ).
        rv_text = VALUE #( lt_values[ low = iv_status ]-ddtext OPTIONAL ).
      CATCH cx_root ##CATCH_ALL ##NO_HANDLER.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
