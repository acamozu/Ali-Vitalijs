CLASS zcl_esm_web_check DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_http_extension.

  PRIVATE SECTION.
    TYPES: BEGIN OF ty_error,
             error TYPE string,
           END OF ty_error.

    TYPES: BEGIN OF ty_answer,
             status      TYPE /aesm/dte_fl_status,
             tech_status TYPE /aesm/dte_fl_tech_status,
             request_id  TYPE /aesm/dte_request_id,
           END OF ty_answer.

    TYPES BEGIN OF ty_response.
    INCLUDE TYPE /aesm/str_fl_status.
    TYPES: request_id TYPE /aesm/dte_request_id,
           bp_number  TYPE string,
           bp_error   TYPE string,
           from_monitoring TYPE abap_bool,
           END OF ty_response.

    "! Marks history records written for an answer from the monitoring (no Schufa query)
    CONSTANTS c_monitoring_note TYPE string VALUE `Monitoring:` ##NO_TEXT.

    "! The partner of the request (partner number, or exactly one matching partner) is in Schufa
    "! monitoring: answer with its last check result without a new Schufa query and note it in the history
    METHODS answer_from_monitoring
      IMPORTING
        is_partner     TYPE /aesm/str_bp
      EXPORTING
        es_response    TYPE ty_response
      RETURNING
        VALUE(rv_done) TYPE abap_bool.

    "! Schufa has an active monitoring with exactly this reference (lookup only, no person search)
    METHODS is_in_monitoring
      IMPORTING
        iv_reference     TYPE csequence
      RETURNING
        VALUE(rv_active) TYPE abap_bool.

    METHODS respond
      IMPORTING
        io_server TYPE REF TO if_http_server
        iv_code   TYPE i
        iv_reason TYPE string
        iv_json   TYPE string.

    "! Schufa reference for data without BP: 'WEB' + hash of name and birthdate (30 chars)
    METHODS build_reference
      IMPORTING
        is_partner          TYPE /aesm/str_bp
      RETURNING
        VALUE(rv_reference) TYPE /aesm/dte_external_reference.

    "! Existing person partner with the same data: first and last name 1:1 (case ignored); birthdate,
    "! middle name and address only where filled on both sides. Several candidates, or a request without
    "! birthdate for a partner with one, is ambiguous: the officer decides in the cockpit.
    METHODS find_partner
      IMPORTING
        is_partner   TYPE /aesm/str_bp
      EXPORTING
        ev_partner   TYPE bu_partner
        ev_ambiguous TYPE abap_bool.

    "! After a Schufa query: create the person as business partner (role prospect)
    "! and move its check records from the generic reference to the new partner
    METHODS take_over_as_bp
      IMPORTING
        is_partner    TYPE /aesm/str_bp
        iv_request_id TYPE /aesm/dte_request_id
      EXPORTING
        ev_partner TYPE bu_partner
        ev_error   TYPE string.

    "! ' ' = partner field empty or equal, 'M' = filled in the partner but missing in the request,
    "! 'X' = both filled and different (case and outer blanks ignored)
    METHODS field_state
      IMPORTING
        iv_request      TYPE csequence
        iv_partner      TYPE csequence
      RETURNING
        VALUE(rv_state) TYPE char1.

    METHODS respond_error
      IMPORTING
        io_server TYPE REF TO if_http_server
        iv_code   TYPE i
        iv_reason TYPE string
        iv_text   TYPE string.
ENDCLASS.



CLASS ZCL_ESM_WEB_CHECK IMPLEMENTATION.


METHOD if_http_extension~handle_request.
    DATA ls_partner TYPE /aesm/str_bp.
    DATA ls_status  TYPE /aesm/str_fl_status.
    DATA lt_return  TYPE STANDARD TABLE OF bapiret2 WITH EMPTY KEY.

    IF server->request->get_method( ) = 'GET' AND server->request->get_form_field( 'cockpit' ) = '1'.
      " Accounts page of the web app: Vertragsmeldungen of /S2SSWS/DB_IN.
      " EK: open accounts only = Meldeart Neumeldung, minus the persons that already have an
      " Erledigungsmeldung (contract ended) or Löschungsmeldung (contract deleted): those are signed out.
      " Nothing for EK -> AG as it is.
      TYPES: BEGIN OF ty_acc,
               merkmalcode  TYPE /s2ssws/db_in-merkmalcode,
               meldeart     TYPE /s2ssws/db_in-meldeart,
               vorname      TYPE /s2ssws/db_in-vorname,
               nachname     TYPE /s2ssws/db_in-nachname,
               geschlecht   TYPE /s2ssws/db_in-geschlecht,
               geburtsdatum TYPE /s2ssws/db_in-geburtsdatum,
               geburtsort   TYPE /s2ssws/db_in-geburtsort,
               strasse      TYPE /s2ssws/db_in-strasse,
               plz          TYPE /s2ssws/db_in-plz,
               ort          TYPE /s2ssws/db_in-ort,
               land         TYPE /s2ssws/db_in-land,
               partner      TYPE /s2ssws/db_partn-partner,
             END OF ty_acc.
      DATA lt_all TYPE STANDARD TABLE OF ty_acc WITH EMPTY KEY.
      DATA lt_out TYPE STANDARD TABLE OF ty_acc WITH EMPTY KEY.
      DATA lv_code TYPE /s2ssws/db_in-merkmalcode VALUE 'EK'.
      DO 2 TIMES.
        SELECT i~merkmalcode, i~meldeart, i~vorname, i~nachname, i~geschlecht, i~geburtsdatum, i~geburtsort,
               i~strasse, i~plz, i~ort, i~land, p~partner
          FROM /s2ssws/db_in AS i
          LEFT OUTER JOIN /s2ssws/db_partn AS p ON p~daten_guid = i~daten_guid
          WHERE i~merkmalcode = @lv_code
          ORDER BY i~crdat DESCENDING, i~crtim DESCENDING
          INTO CORRESPONDING FIELDS OF TABLE @lt_all
          UP TO 5000 ROWS.
        lt_out = lt_all.
        IF lv_code = 'EK'.
          DELETE lt_out WHERE meldeart <> 'Neumeldung'.
          " same person (name + birth date) = same account; there is no account number yet
          LOOP AT lt_all INTO DATA(ls_closed) WHERE meldeart = 'Erledigungsmeldung' OR meldeart = 'Löschungsmeldung'.
            DELETE lt_out WHERE vorname = ls_closed-vorname
                            AND nachname = ls_closed-nachname
                            AND geburtsdatum = ls_closed-geburtsdatum.
          ENDLOOP.
        ENDIF.
        IF lt_out IS NOT INITIAL.
          EXIT.
        ENDIF.
        lv_code = 'AG'.
      ENDDO.
      IF lines( lt_out ) > 200.
        DELETE lt_out FROM 201.
      ENDIF.
      " text of the code, if the OUT table knows it (EK is not in it: the web app has the text)
      SELECT SINGLE beschreibung FROM /s2ssws/db_out_d WHERE merkmalcode = @lv_code INTO @DATA(lv_desc).
      DATA: BEGIN OF ls_cockpit,
              merkmalcode  TYPE string,
              beschreibung TYPE string,
              rows         TYPE REF TO data,
            END OF ls_cockpit.
      ls_cockpit-merkmalcode = lv_code.
      ls_cockpit-beschreibung = lv_desc.
      ls_cockpit-rows = REF #( lt_out ).
      respond(
        io_server = server
        iv_code   = 200
        iv_reason = `OK`
        iv_json   = /ui2/cl_json=>serialize( data = ls_cockpit pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
      RETURN.
    ENDIF.

    " POST ?action=abmelden {"partner":"..."} : Vertrag kündigen = EK Erledigungsmeldung for the business
    " partner (class ZCL_S2S_SIM_EK_ABMELDUNG, test system A2H). Only partners that have an open EK
    " Neumeldung (= are in the Konten list) can be cancelled.
    IF server->request->get_method( ) = 'POST' AND server->request->get_form_field( 'action' ) = 'abmelden'.
      TYPES: BEGIN OF ty_cancel,
               partner TYPE string,
             END OF ty_cancel.
      DATA ls_cancel TYPE ty_cancel.
      TRY.
          /ui2/cl_json=>deserialize(
            EXPORTING json = server->request->get_cdata( )
            CHANGING  data = ls_cancel ).
        CATCH cx_root.
          respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `Body is not valid JSON.` ).
          RETURN.
      ENDTRY.
      IF ls_cancel-partner IS INITIAL OR ls_cancel-partner CN '0123456789' OR strlen( ls_cancel-partner ) > 10.
        respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `partner is required.` ).
        RETURN.
      ENDIF.
      DATA(lv_cancel_partner) = CONV bu_partner( |{ ls_cancel-partner ALPHA = IN }| ).
      SELECT SINGLE i~daten_guid
        FROM /s2ssws/db_in AS i
        INNER JOIN /s2ssws/db_partn AS p ON p~daten_guid = i~daten_guid
        WHERE p~partner = @lv_cancel_partner
          AND i~merkmalcode = 'EK'
          AND i~meldeart = 'Neumeldung'
        INTO @DATA(lv_open_guid).
      IF sy-subrc <> 0.
        respond_error( io_server = server iv_code = 404 iv_reason = `Not Found` iv_text = `No open EK contract for this partner.` ).
        RETURN.
      ENDIF.
      DATA(ls_cancelled) = zcl_s2s_sim_ek_abmeldung=>abmelden( iv_partner = lv_cancel_partner ).
      IF ls_cancelled-success = abap_false.
        respond_error(
          io_server = server iv_code = 409 iv_reason = `Conflict`
          iv_text   = COND #( WHEN ls_cancelled-message IS INITIAL THEN `Cancellation failed.` ELSE ls_cancelled-message ) ).
        RETURN.
      ENDIF.
      respond(
        io_server = server
        iv_code   = 200
        iv_reason = `OK`
        iv_json   = /ui2/cl_json=>serialize( data = ls_cancelled pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
      RETURN.
    ENDIF.

    " GET ?request_id=... : current status of an earlier check (the web app polls this while an
    " officer decides in the BP cockpit). Only requests that came from this web app are readable.
    IF server->request->get_method( ) = 'GET'.
      DATA lv_request_id TYPE /aesm/dte_request_id.
      DATA(lv_param) = server->request->get_form_field( 'request_id' ).
      IF lv_param IS INITIAL OR lv_param CN '0123456789'.
        respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `request_id is required.` ).
        RETURN.
      ENDIF.
      lv_request_id = lv_param.
      SELECT SINGLE status, tech_status
        FROM /aesm/db_flwcntr
        WHERE request_id = @lv_request_id
          AND external_id = 'WEBAPP'
        INTO @DATA(ls_current).
      IF sy-subrc <> 0.
        respond_error( io_server = server iv_code = 404 iv_reason = `Not Found` iv_text = `Unknown request_id.` ).
        RETURN.
      ENDIF.
      respond(
        io_server = server
        iv_code   = 200
        iv_reason = `OK`
        iv_json   = /ui2/cl_json=>serialize(
                      data        = VALUE ty_answer( status = ls_current-status tech_status = ls_current-tech_status request_id = lv_param )
                      pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
      RETURN.
    ENDIF.

    IF server->request->get_method( ) <> 'POST'.
      respond_error( io_server = server iv_code = 405 iv_reason = `Method Not Allowed` iv_text = `Use GET or POST.` ).
      RETURN.
    ENDIF.

    TRY.
        /ui2/cl_json=>deserialize(
          EXPORTING json = server->request->get_cdata( )
          CHANGING  data = ls_partner ).
      CATCH cx_root.
        respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `Body is not valid JSON.` ).
        RETURN.
    ENDTRY.

    IF ls_partner-external_object <> /aesm/cl_partner_handler=>con_sap_partner_object
       AND ( ls_partner-lastname IS INITIAL OR ls_partner-firstname IS INITIAL ).
      respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `FIRSTNAME and LASTNAME are required.` ).
      RETURN.
    ENDIF.

    " TEST SYSTEM ONLY: a lookup of an existing SAP business partner ('BP' + BP_NUMBER) is let through.
    " Before production, force 'MD' for every request, otherwise any caller can probe real BPs.
    IF ls_partner-external_object = /aesm/cl_partner_handler=>con_sap_partner_object.
      IF ls_partner-bp_number IS INITIAL.
        respond_error( io_server = server iv_code = 400 iv_reason = `Bad Request` iv_text = `BP_NUMBER is required for BP lookups.` ).
        RETURN.
      ENDIF.
    ELSE.
      ls_partner-external_object = /aesm/cl_partner_handler=>con_metadata_object.
      " Schufa ties a reference to the person data it saw first and rejects other data under the same
      " reference (400). Same person -> same reference, other person -> new reference.
      ls_partner-bp_number = build_reference( ls_partner ).
    ENDIF.
    IF ls_partner-external_id IS INITIAL.
      ls_partner-external_id = 'WEBAPP'.
    ENDIF.

    " Partner already in Schufa monitoring: no new Schufa query, the last result is the answer
    DATA ls_monitoring_answer TYPE ty_response.
    IF answer_from_monitoring( EXPORTING is_partner  = ls_partner
                               IMPORTING es_response = ls_monitoring_answer ) EQ abap_true.
      respond(
        io_server = server
        iv_code   = 200
        iv_reason = `OK`
        iv_json   = /ui2/cl_json=>serialize( data        = ls_monitoring_answer
                                            compress    = abap_true
                                            pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
      RETURN.
    ENDIF.

    TRY.
        CALL FUNCTION '/AESM/FM_CHECK_BP'
          EXPORTING
            is_partner = ls_partner
          IMPORTING
            es_status  = ls_status
          TABLES
            et_return  = lt_return.
      CATCH cx_root INTO DATA(lx_root).
        respond_error( io_server = server iv_code = 500 iv_reason = `Internal Server Error` iv_text = lx_root->get_text( ) ).
        RETURN.
    ENDTRY.

    " The FM swallows all exceptions into ET_RETURN and leaves ES_STATUS empty.
    IF lt_return IS NOT INITIAL OR ls_status-status IS INITIAL.
      DATA(lv_text) = ``.
      LOOP AT lt_return INTO DATA(ls_return).
        lv_text = COND #( WHEN lv_text IS INITIAL THEN ls_return-message ELSE |{ lv_text }; { ls_return-message }| ).
      ENDLOOP.
      IF lv_text IS INITIAL.
        lv_text = `Check returned no status.`.
      ENDIF.
      respond_error( io_server = server iv_code = 500 iv_reason = `Internal Server Error` iv_text = lv_text ).
      RETURN.
    ENDIF.

    " Safety: make sure the DB_FLWCNTR record written by the check is persisted.
    COMMIT WORK AND WAIT.

    " The FM does not return the id of the flow record it wrote. Take the newest record of this
    " web app for the same name; the app polls its status with it. Empty = the app does not poll.
    SELECT request_id
      FROM /aesm/db_flwcntr
      WHERE external_id = 'WEBAPP'
        AND firstname   = @ls_partner-firstname
        AND lastname    = @ls_partner-lastname
      ORDER BY request_id DESCENDING
      INTO @DATA(lv_new_id)
      UP TO 1 ROWS.
    ENDSELECT.

    DATA(ls_response) = CORRESPONDING ty_response( ls_status ).
    ls_response-request_id = lv_new_id.

    " Data without BP that went to Schufa (01 clean, 02 Schufa hit) becomes a business partner
    IF ls_partner-external_object = /aesm/cl_partner_handler=>con_metadata_object
       AND ( ls_status-status = '01' OR ls_status-status = '02' ).
      take_over_as_bp( EXPORTING is_partner    = ls_partner
                                 iv_request_id = lv_new_id
                       IMPORTING ev_partner    = DATA(lv_partner)
                                 ev_error   = ls_response-bp_error ).
      IF lv_partner IS NOT INITIAL.
        ls_response-bp_number = condense( |{ lv_partner ALPHA = OUT }| ).
        " Schufa monitoring under the partner number, as /AESM/CL_PROCESS does for checks of SAP partners
        IF /aesm/cl_cfg_helper=>s_instance( )->getb( iv_feld = 'SCHUFA_CPL_SVC'
                                                     iv_wert = 'MONITORING'
                                                     iv_defv = abap_false ) EQ abap_true ##NO_TEXT.
          TRY.
              /aesm/clb_verify_external=>register_monitoring(
                iv_reference = ls_response-bp_number
                is_metadata  = /aesm/cl_partner_handler=>s_instance( )->map_to_metadata( ls_partner ) ).
            CATCH /aesm/cx_input_error ##NO_HANDLER.
              " no monitoring, the check result itself is still valid
          ENDTRY.
        ENDIF.
      ENDIF.
    ENDIF.

    respond(
      io_server = server
      iv_code   = 200
      iv_reason = `OK`
      iv_json   = /ui2/cl_json=>serialize( data        = ls_response
                                          compress    = abap_true
                                          pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
  ENDMETHOD.


  METHOD take_over_as_bp.
    DATA(lv_reference) = is_partner-bp_number.

    " Exactly one existing partner with the same data: the check belongs to it.
    " No candidate: a new partner (also when the same person asks again with other data)
    find_partner( EXPORTING is_partner   = is_partner
                  IMPORTING ev_partner   = ev_partner
                            ev_ambiguous = DATA(lv_ambiguous) ).
    IF lv_ambiguous EQ abap_true.
      RETURN. " the check keeps its WEB reference
    ENDIF.

    IF ev_partner IS INITIAL.
      " New partner via BP inbound interface: central data, person, role prospect and address in one call.
      " Internal number range (grouping 0001); the partner is found afterwards by its GUID.
      TRY.
          DATA(lv_guid_x) = cl_system_uuid=>create_uuid_x16_static( ).
        CATCH cx_uuid_error INTO DATA(lx_uuid).
          ev_error = lx_uuid->get_text( ).
          RETURN.
      ENDTRY.
      DATA(lv_guid_c) = CONV bu_partner_guid_bapi( lv_guid_x ).

      DATA(ls_bp) = VALUE bus_ei_extern(
        header-object_task                   = 'I'
        header-object_instance-bpartnerguid  = lv_guid_c ).

      ls_bp-central_data-common-data-bp_control = VALUE #( category = '1' grouping = '0001' ).
      ls_bp-central_data-common-data-bp_centraldata-searchterm1 = to_upper( is_partner-lastname ).
      ls_bp-central_data-common-data-bp_person = VALUE #(
        firstname          = is_partner-firstname
        lastname           = is_partner-lastname
        middlename         = is_partner-middlename
        birthdate          = is_partner-b_date
        sex                = SWITCH #( is_partner-gender WHEN 'F' THEN '1' WHEN 'M' THEN '2' ELSE ' ' )
        nationality        = is_partner-natio
        correspondlanguage = sy-langu ).
      ls_bp-central_data-common-datax-bp_centraldata-searchterm1 = abap_true.
      ls_bp-central_data-common-datax-bp_person = VALUE #(
        firstname          = abap_true
        lastname           = abap_true
        middlename         = abap_true
        birthdate          = abap_true
        sex                = abap_true
        nationality        = abap_true
        correspondlanguage = abap_true ).

      ls_bp-central_data-role-roles = VALUE #(
        ( task = 'I' data_key = 'BUP002'
          data  = VALUE #( rolecategory = 'BUP002' valid_from = sy-datlo valid_to = '99991231' )
          datax = VALUE #( valid_from = abap_true valid_to = abap_true ) ) ).

      " An address needs a country; without one the partner is created without address
      IF is_partner-country IS NOT INITIAL.
        ls_bp-central_data-address-addresses = VALUE #(
          ( task                  = 'I'
            data_key-operation    = 'XXDFLT'
            currently_valid       = abap_true
            data-postal-data      = VALUE #( street     = is_partner-street
                                             house_no   = is_partner-houseno
                                             postl_cod1 = is_partner-pocode
                                             city       = is_partner-city
                                             country    = is_partner-country
                                             building   = is_partner-building
                                             room_no    = is_partner-roomno
                                             langu      = sy-langu
                                             validfromdate = sy-datlo
                                             validtodate   = '99991231' )
            data-postal-datax     = VALUE #( street     = abap_true
                                             house_no   = abap_true
                                             postl_cod1 = abap_true
                                             city       = abap_true
                                             country    = abap_true
                                             building   = abap_true
                                             room_no    = abap_true
                                             langu      = abap_true
                                             validfromdate = abap_true
                                             validtodate   = abap_true )
            " The inbound interface does not add the standard usage on its own (BAPI does)
            data-addr_usage-addr_usages = VALUE #(
              ( task     = 'I'
                data_key = VALUE #( addresstype = 'XXDEFAULT' valid_to = '99991231' )
                data     = VALUE #( standard = abap_true valid_from = sy-datlo )
                datax    = VALUE #( standard = abap_true valid_from = abap_true ) ) ) ) ).
      ENDIF.

      DATA(lt_data) = VALUE bus_ei_extern_t( ( ls_bp ) ).
      DATA lt_bp_return TYPE bapiretm.
      CALL FUNCTION 'BUPA_INBOUND_MAIN_SAVE'
        EXPORTING
          data   = lt_data
        IMPORTING
          return = lt_bp_return.

      LOOP AT lt_bp_return INTO DATA(ls_bp_return).
        LOOP AT ls_bp_return-object_msg INTO DATA(ls_msg) WHERE type CA 'EA'.
          ev_error = COND #( WHEN ev_error IS INITIAL THEN ls_msg-message ELSE |{ ev_error }; { ls_msg-message }| ).
        ENDLOOP.
      ENDLOOP.
      IF ev_error IS NOT INITIAL.
        ROLLBACK WORK.
        RETURN.
      ENDIF.
      COMMIT WORK AND WAIT.

      SELECT SINGLE partner FROM but000 WHERE partner_guid EQ @lv_guid_x INTO @ev_partner.
      IF sy-subrc NE 0.
        ev_error = |Business partner was not created (GUID { lv_guid_c }).|.
        RETURN.
      ENDIF.
    ENDIF.

    " Check records: generic reference -> partner number (without leading zeros, as from the BP transaction).
    " The Schufa answer stays linked, it hangs on the record GUID (DB_APILG-GUID = DB_FLWCNTR-GUID).
    DATA(lv_bp_number) = CONV /aesm/dte_external_reference( |{ ev_partner ALPHA = OUT }| ).
    UPDATE /aesm/db_flwcntr
      SET external_object    = @/aesm/cl_partner_handler=>con_sap_partner_object,
          external_reference = @lv_bp_number,
          parent_reference   = @lv_reference,
          bp_type            = '1'
      WHERE external_object    EQ @/aesm/cl_partner_handler=>con_metadata_object
        AND external_reference EQ @lv_reference
        AND request_id         EQ @iv_request_id. " only this check, other checks of the same name may be other persons
    IF sy-dbcnt GT 0.
      " BAdI /AESM/BADI_CHECK_FINISHED: the check now belongs to a partner (e.g. entry in S2S SCHUFA_B)
      TRY.
          DATA lo_badi_finished TYPE REF TO /aesm/badi_check_finished.
          GET BADI lo_badi_finished.
          CALL BADI lo_badi_finished->partner_assigned
            EXPORTING
              iv_request_id = iv_request_id
              iv_partner    = ev_partner.
        CATCH cx_root ##CATCH_ALL ##NO_HANDLER.
      ENDTRY.
    ENDIF.
    COMMIT WORK AND WAIT.
  ENDMETHOD.


  METHOD find_partner.
    DATA lv_mc_last   TYPE but000-mc_name1.
    DATA lt_hits      TYPE STANDARD TABLE OF bu_partner WITH EMPTY KEY.
    DATA lv_uncertain TYPE abap_bool.

    CLEAR: ev_partner, ev_ambiguous.
    DATA(lv_first) = to_upper( condense( is_partner-firstname ) ).
    DATA(lv_last)  = to_upper( condense( is_partner-lastname ) ).
    CHECK lv_first IS NOT INITIAL AND lv_last IS NOT INITIAL.
    lv_mc_last = lv_last.

    SELECT partner, name_first, name_last, namemiddle, birthdt
      FROM but000
      WHERE type  EQ '1'
        AND xdele EQ @abap_false
        AND ( mc_name1 EQ @lv_mc_last OR name_last EQ @is_partner-lastname )
      INTO TABLE @DATA(lt_bp).

    LOOP AT lt_bp INTO DATA(ls_bp)
         WHERE name_first IS NOT INITIAL.
      CHECK to_upper( condense( ls_bp-name_first ) ) EQ lv_first
        AND to_upper( condense( ls_bp-name_last ) )  EQ lv_last.
      DATA(lv_middle) = field_state( iv_request = is_partner-middlename iv_partner = ls_bp-namemiddle ).
      CHECK lv_middle NE 'X'.

      DATA(lv_req_birth) = xsdbool( is_partner-b_date IS NOT INITIAL AND is_partner-b_date NE '00000000' ).
      DATA(lv_bp_birth)  = xsdbool( ls_bp-birthdt IS NOT INITIAL AND ls_bp-birthdt NE '00000000' ).
      CHECK lv_req_birth EQ abap_false OR lv_bp_birth EQ abap_false OR ls_bp-birthdt EQ is_partner-b_date.

      " Address: one address of the partner must not contradict the request. A sure match needs
      " every field of that address in the request too; a missing one makes it only a proposal.
      DATA(lv_adr_full) = abap_true.
      SELECT a~street, a~house_num1, a~post_code1, a~city1, a~country
        FROM but020 AS b INNER JOIN adrc AS a ON a~addrnumber EQ b~addrnumber
        WHERE b~partner EQ @ls_bp-partner
        INTO TABLE @DATA(lt_adr).
      IF lt_adr IS NOT INITIAL.
        DATA(lv_adr_ok) = abap_false.
        lv_adr_full = abap_false.
        LOOP AT lt_adr INTO DATA(ls_adr).
          DATA(lv_states) = field_state( iv_request = is_partner-street  iv_partner = ls_adr-street )
                         && field_state( iv_request = is_partner-houseno iv_partner = ls_adr-house_num1 )
                         && field_state( iv_request = is_partner-pocode  iv_partner = ls_adr-post_code1 )
                         && field_state( iv_request = is_partner-city    iv_partner = ls_adr-city1 )
                         && field_state( iv_request = is_partner-country iv_partner = ls_adr-country ).
          CHECK lv_states NA 'X'.
          lv_adr_ok = abap_true.
          IF lv_states NA 'M'.
            lv_adr_full = abap_true.
          ENDIF.
        ENDLOOP.
        CHECK lv_adr_ok EQ abap_true.
      ENDIF.

      APPEND ls_bp-partner TO lt_hits.
      " Birthdate, middle name or address part forgotten in the request: only a proposal,
      " the officer confirms it in the cockpit
      IF ( lv_req_birth EQ abap_false AND lv_bp_birth EQ abap_true ) OR lv_middle EQ 'M' OR lv_adr_full EQ abap_false.
        lv_uncertain = abap_true.
      ENDIF.
    ENDLOOP.

    CASE lines( lt_hits ).
      WHEN 0.
      WHEN 1.
        IF lv_uncertain EQ abap_true.
          ev_ambiguous = abap_true.
        ELSE.
          ev_partner = lt_hits[ 1 ].
        ENDIF.
      WHEN OTHERS.
        ev_ambiguous = abap_true.
    ENDCASE.
  ENDMETHOD.


  METHOD field_state.
    DATA(lv_request) = to_upper( condense( iv_request ) ).
    DATA(lv_partner) = to_upper( condense( iv_partner ) ).
    rv_state = COND #( WHEN lv_partner IS INITIAL OR lv_request EQ lv_partner THEN ' '
                       WHEN lv_request IS INITIAL                             THEN 'M'
                       ELSE                                                        'X' ).
  ENDMETHOD.


  METHOD build_reference.
    " Trimmed like the Schufa query; first and middle name go to Schufa as one first name
    DATA(lv_key) = |{ shift_left( shift_right( is_partner-lastname ) ) }/| &&
                   |{ shift_left( shift_right( |{ is_partner-firstname } { is_partner-middlename }| ) ) }/| &&
                   |{ is_partner-b_date }|.
    TRY.
        cl_abap_message_digest=>calculate_hash_for_char(
          EXPORTING if_algorithm  = 'SHA1'
                    if_data       = lv_key
          IMPORTING ef_hashstring = DATA(lv_hash) ).
      CATCH cx_abap_message_digest.
        lv_hash = |{ to_upper( lv_key ) }{ repeat( val = `0` occ = 27 ) }|. "never happens with SHA1
    ENDTRY.
    rv_reference = |WEB{ substring( val = lv_hash len = 27 ) }|.
  ENDMETHOD.


  METHOD respond.
    io_server->response->set_status( code = iv_code reason = iv_reason ).
    io_server->response->set_header_field( name = 'Content-Type' value = 'application/json; charset=utf-8' ).
    io_server->response->set_cdata( iv_json ).
  ENDMETHOD.


  METHOD respond_error.
    respond(
      io_server = io_server
      iv_code   = iv_code
      iv_reason = iv_reason
      iv_json   = /ui2/cl_json=>serialize(
                    data        = VALUE ty_error( error = iv_text )
                    pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
  ENDMETHOD.

  METHOD answer_from_monitoring.
    CLEAR es_response.

    " Partner of the request: given partner number, or exactly one partner with the same data
    DATA lv_partner TYPE bu_partner.
    IF is_partner-external_object EQ /aesm/cl_partner_handler=>con_sap_partner_object.
      lv_partner = condense( is_partner-bp_number ).
      lv_partner = |{ lv_partner ALPHA = IN }|.
    ELSE.
      find_partner( EXPORTING is_partner   = is_partner
                    IMPORTING ev_partner   = lv_partner
                              ev_ambiguous = DATA(lv_ambiguous) ).
      IF lv_ambiguous EQ abap_true.
        RETURN.
      ENDIF.
    ENDIF.
    IF lv_partner IS INITIAL.
      RETURN.
    ENDIF.
    DATA(lv_bp_number) = CONV /aesm/dte_external_reference( |{ lv_partner ALPHA = OUT }| ).

    " Last real check of this partner (not an earlier monitoring answer), with the officer's decision if any
    DATA(lv_note_pattern) = |{ c_monitoring_note }%|.
    SELECT * FROM /aesm/db_flwcntr
      WHERE external_object    EQ @/aesm/cl_partner_handler=>con_sap_partner_object
        AND external_reference EQ @lv_bp_number
        AND note               NOT LIKE @lv_note_pattern
      ORDER BY request_id DESCENDING
      INTO @DATA(ls_last)
      UP TO 1 ROWS.
    ENDSELECT.
    IF sy-subrc NE 0 OR ls_last-status IS INITIAL.
      RETURN.
    ENDIF.

    IF is_in_monitoring( lv_bp_number ) EQ abap_false.
      RETURN.
    ENDIF.

    " History: own record for this request, answer taken over from the last check.
    " Closed automatically, so an open suspicion does not appear a second time in the cockpit.
    DATA(ls_new) = ls_last.
    TRY.
        ls_new-guid       = cl_system_uuid=>create_uuid_x16_static( ).
        ls_new-request_id = /aesm/cl_input_handler=>get_next_request_id( ).
      CATCH cx_root.
        RETURN.
    ENDTRY.
    ls_new-request_date     = sy-datlo.
    ls_new-external_id      = is_partner-external_id.
    ls_new-parent_reference = COND #( WHEN is_partner-external_object NE /aesm/cl_partner_handler=>con_sap_partner_object
                                      THEN is_partner-bp_number ).
    ls_new-process_status   = 'A'.
    ls_new-note             = |{ c_monitoring_note } keine SCHUFA-Abfrage, Ergebnis aus Request { ls_last-request_id ALPHA = OUT }| ##NO_TEXT.
    CLEAR: ls_new-editor, ls_new-officer_note, ls_new-entity_guid.
    IF is_partner-external_object NE /aesm/cl_partner_handler=>con_sap_partner_object.
      " the data as entered in the web app
      ls_new-lastname   = is_partner-lastname.
      ls_new-firstname  = is_partner-firstname.
      ls_new-middlename = is_partner-middlename.
      ls_new-natio      = is_partner-natio.
      ls_new-city       = is_partner-city.
      ls_new-street     = is_partner-street.
      ls_new-country    = is_partner-country.
      ls_new-pocode     = is_partner-pocode.
    ENDIF.
    ls_new-crusr = ls_new-chusr = sy-uname.
    ls_new-crdat = ls_new-chdat = sy-datum.
    ls_new-crtim = ls_new-chtim = sy-uzeit.
    INSERT /aesm/db_flwcntr FROM @ls_new.
    IF sy-subrc NE 0.
      RETURN.
    ENDIF.
    COMMIT WORK AND WAIT.

    es_response-status          = ls_last-status.
    es_response-tech_status     = ls_last-tech_status.
    es_response-request_id      = ls_new-request_id.
    es_response-bp_number       = condense( lv_bp_number ).
    es_response-from_monitoring = abap_true.
    rv_done = abap_true.
  ENDMETHOD.


  METHOD is_in_monitoring.
    TRY.
        DATA(lo_api) = /aesm/cl_sch_api_engine=>create( ).
        " the search text is not exact (12 also finds 312), the reference must match
        lo_api->/aesm/if_sch_api_engine~monitorings_get(
          EXPORTING iv_limit    = 100
                    iv_q        = condense( iv_reference )
          IMPORTING es_response = DATA(ls_monitorings) ).
        LOOP AT ls_monitorings-items INTO DATA(ls_item).
          IF condense( ls_item-reference ) EQ condense( iv_reference ).
            rv_active = abap_true.
            RETURN.
          ENDIF.
        ENDLOOP.
      CATCH cx_root ##CATCH_ALL.
        " no answer from Schufa: treat as not monitored, the normal check runs
        rv_active = abap_false.
    ENDTRY.
  ENDMETHOD.
ENDCLASS.
