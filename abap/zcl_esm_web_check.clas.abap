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

    IF server->request->get_method( ) <> 'POST'.
      respond_error( io_server = server iv_code = 405 iv_reason = `Method Not Allowed` iv_text = `Use POST.` ).
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
      ls_partner-bp_number       = /aesm/cl_partner_handler=>con_not_provided.
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

    respond(
      io_server = server
      iv_code   = 200
      iv_reason = `OK`
      iv_json   = /ui2/cl_json=>serialize( data = ls_status pretty_name = /ui2/cl_json=>pretty_mode-camel_case ) ).
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
