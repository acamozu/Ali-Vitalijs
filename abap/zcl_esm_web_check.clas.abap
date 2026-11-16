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

    METHODS respond
      IMPORTING
        io_server TYPE REF TO if_http_server
        iv_code   TYPE i
        iv_reason TYPE string
        iv_json   TYPE string.

    METHODS respond_error
      IMPORTING
        io_server TYPE REF TO if_http_server
        iv_code   TYPE i
        iv_reason TYPE string
        iv_text   TYPE string.
ENDCLASS.



CLASS zcl_esm_web_check IMPLEMENTATION.

  METHOD if_http_extension~handle_request.
    DATA ls_partner TYPE /aesm/str_bp.
    DATA ls_status  TYPE /aesm/str_fl_status.
    DATA lt_return  TYPE STANDARD TABLE OF bapiret2 WITH EMPTY KEY.

    " GET ?request_id=... : current status of an earlier check (the web app polls this while an
    " officer decides in the BP cockpit). Only requests that came from this web app are readable.
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
      DATA(lv_partner) = CONV bu_partner( |{ ls_cancel-partner ALPHA = IN }| ).
      SELECT SINGLE i~daten_guid
        FROM /s2ssws/db_in AS i
        INNER JOIN /s2ssws/db_partn AS p ON p~daten_guid = i~daten_guid
        WHERE p~partner = @lv_partner
          AND i~merkmalcode = 'EK'
          AND i~meldeart = 'Neumeldung'
        INTO @DATA(lv_open_guid).
      IF sy-subrc <> 0.
        respond_error( io_server = server iv_code = 404 iv_reason = `Not Found` iv_text = `No open EK contract for this partner.` ).
        RETURN.
      ENDIF.
      DATA(ls_cancelled) = zcl_s2s_sim_ek_abmeldung=>abmelden( iv_partner = lv_partner ).
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
      " Schufa ties a reference to the name it saw first and rejects any other name under the same
      " reference (400). Without a BP every request needs its own reference, not a shared NOTPROVIDED.
      TRY.
          ls_partner-bp_number = |WEB{ substring( val = cl_system_uuid=>create_uuid_c32_static( ) len = 20 ) }|.
        CATCH cx_uuid_error.
          ls_partner-bp_number = |WEB{ sy-datum }{ sy-uzeit }|.
      ENDTRY.
    ENDIF.
    IF ls_partner-external_id IS INITIAL.
      ls_partner-external_id = 'WEBAPP'.
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

    respond(
      io_server = server
      iv_code   = 200
      iv_reason = `OK`
      iv_json   = /ui2/cl_json=>serialize(
                    data        = VALUE ty_answer( status = ls_status-status tech_status = ls_status-tech_status request_id = lv_new_id )
                    pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
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

ENDCLASS.
